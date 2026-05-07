'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, RefreshCw, ExternalLink, TrendingDown, TrendingUp, Minus, Search } from 'lucide-react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { CompetitorTable } from '@/components/dashboard/CompetitorTable';
import { PriceChart } from '@/components/dashboard/PriceChart';
import { useProduct, useAddCompetitor, usePriceHistory } from '@/hooks/useProducts';
import api from '@/lib/api';

interface MLResult {
  id: string;
  title: string;
  price: number;
  currency: string;
  thumbnail: string;
  url: string;
}

type CompStep = 'search' | 'url';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: product, isLoading, error, refetch } = useProduct(id);
  const { data: priceHistory = [] } = usePriceHistory(id);
  const addCompetitor = useAddCompetitor(id);

  const [modalOpen, setModalOpen] = useState(false);
  const [compStep, setCompStep] = useState<CompStep>('search');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [competitorError, setCompetitorError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Search for competitor
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MLResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUrl, setAddingUrl] = useState<string | null>(null);

  const resetModal = () => {
    setCompStep('search');
    setCompetitorUrl('');
    setCompetitorError('');
    setSearchQuery('');
    setSearchResults([]);
    setAddingUrl(null);
  };

  const handleAddViaUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompetitorError('');
    try {
      await addCompetitor.mutateAsync(competitorUrl);
      resetModal();
      setModalOpen(false);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setCompetitorError(msg || 'No se pudo agregar el competidor.');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setCompetitorError('');
    setSearchResults([]);
    try {
      const { data } = await api.get(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(data.results ?? []);
      if (!data.results?.length) setCompetitorError('Sin resultados. Probá otra búsqueda o pegá la URL.');
    } catch {
      setCompetitorError('Error al buscar. Pegá la URL directamente.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCompetitor = async (result: MLResult) => {
    setAddingUrl(result.url);
    setCompetitorError('');
    try {
      await addCompetitor.mutateAsync(result.url);
      setSearchResults((prev) => prev.filter((r) => r.url !== result.url));
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setCompetitorError(msg || 'No se pudo agregar el competidor.');
    } finally {
      setAddingUrl(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post(`/api/products/${id}/refresh`);
      refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="h-48 bg-white rounded-xl border border-gray-200" />
        <div className="h-72 bg-white rounded-xl border border-gray-200" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Producto no encontrado.</p>
        <Button variant="secondary" onClick={() => router.back()}>Volver</Button>
      </div>
    );
  }

  const competitors = product.competitors ?? [];
  const competitorPrices = competitors.map((c) => c.currentPrice).filter((p): p is number => p !== null && p > 0);
  const marketMin = competitorPrices.length ? Math.min(...competitorPrices) : null;
  const marketMax = competitorPrices.length ? Math.max(...competitorPrices) : null;
  const marketAvg = competitorPrices.length ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length : null;

  const myPrice = product.currentPrice ?? null;
  const diffPct = myPrice && marketAvg ? ((myPrice - marketAvg) / marketAvg) * 100 : null;
  const positionLabel = diffPct === null ? null : diffPct < -2 ? 'below' : diffPct > 2 ? 'above' : 'at';

  return (
    <div className="space-y-5">
      {/* Top nav */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/dashboard/products">
          <Button variant="ghost" size="sm"><ArrowLeft size={15} /> Productos</Button>
        </Link>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualizar precios
        </Button>
        <a href={product.url} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" size="sm"><ExternalLink size={14} /> Ver en tienda</Button>
        </a>
        <Button size="sm" onClick={() => { setModalOpen(true); resetModal(); }}>
          <Plus size={14} /> Agregar Competidor
        </Button>
      </div>

      {/* Product hero */}
      <Card>
        <div className="flex gap-6 items-start">
          {product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-24 h-24 object-contain rounded-xl border border-gray-100 bg-gray-50 flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h1>
                {product.sku && <p className="text-sm text-gray-500 mt-0.5">SKU: {product.sku}</p>}
              </div>
              <Badge variant="info">{product.marketplace}</Badge>
            </div>

            {/* Price + market position stats */}
            <div className="flex flex-wrap items-end gap-6 mt-4">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Tu precio</p>
                <p className="text-3xl font-extrabold text-gray-900 tabular-nums">
                  {myPrice ? `$${myPrice.toLocaleString('es-AR')}` : <span className="text-gray-400 text-xl">Sin precio</span>}
                </p>
              </div>

              {marketMin !== null && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Mín. del mercado</p>
                  <p className="text-xl font-bold text-green-600 tabular-nums">${marketMin.toLocaleString('es-AR')}</p>
                </div>
              )}
              {marketAvg !== null && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Promedio del mercado</p>
                  <p className="text-xl font-bold text-gray-600 tabular-nums">${marketAvg.toLocaleString('es-AR')}</p>
                </div>
              )}
              {marketMax !== null && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Máx. del mercado</p>
                  <p className="text-xl font-bold text-red-500 tabular-nums">${marketMax.toLocaleString('es-AR')}</p>
                </div>
              )}
            </div>

            {/* Position indicator */}
            {positionLabel && (
              <div className="mt-3">
                {positionLabel === 'below' && (
                  <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-3 py-1.5 rounded-full">
                    <TrendingDown size={14} />
                    {Math.abs(diffPct!).toFixed(1)}% por debajo del promedio — precio competitivo
                  </div>
                )}
                {positionLabel === 'above' && (
                  <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-3 py-1.5 rounded-full">
                    <TrendingUp size={14} />
                    {Math.abs(diffPct!).toFixed(1)}% por encima del promedio — considerá bajar el precio
                  </div>
                )}
                {positionLabel === 'at' && (
                  <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium px-3 py-1.5 rounded-full">
                    <Minus size={14} />
                    En línea con el mercado
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Price history chart */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de precios — últimos 30 días</CardTitle>
        </CardHeader>
        <PriceChart
          productHistory={priceHistory}
          competitorHistories={competitors.slice(0, 5).map((c) => ({ name: c.name.slice(0, 22), history: [] }))}
        />
      </Card>

      {/* Competitors table */}
      <Card padding={false}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Competidores</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {competitors.length} monitoreados · ordenados por precio
            </p>
          </div>
          <Button size="sm" onClick={() => { setModalOpen(true); resetModal(); }}>
            <Plus size={14} /> Agregar
          </Button>
        </div>
        <CompetitorTable
          product={product}
          competitors={[...competitors].sort((a, b) => (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity))}
        />
      </Card>

      {/* Add competitor modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetModal(); }}
        title="Agregar Competidor"
      >
        {compStep === 'search' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Buscá el producto del competidor en MercadoLibre, o pegá la URL directamente.
            </p>

            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Buscá "${product.name}"...`}
                  autoFocus
                />
              </div>
              <Button type="submit" loading={searching} disabled={!searchQuery.trim()}>
                <Search size={16} />
              </Button>
            </form>

            {competitorError && !searchResults.length && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{competitorError}</p>
            )}

            {searchResults.length > 0 && (
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectCompetitor(result)}
                    disabled={addingUrl === result.url}
                    className="w-full flex items-center gap-3 p-3 hover:bg-brand-50 transition-colors text-left disabled:opacity-50"
                  >
                    {result.thumbnail && (
                      <img src={result.thumbnail} alt={result.title} className="w-11 h-11 object-contain rounded-lg flex-shrink-0 bg-gray-50 border border-gray-100" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm line-clamp-2 leading-snug">{result.title}</p>
                      <p className="text-brand-600 font-bold text-sm mt-1">
                        {result.currency} ${result.price?.toLocaleString('es-AR')}
                      </p>
                    </div>
                    {addingUrl === result.url
                      ? <RefreshCw size={15} className="animate-spin text-brand-400" />
                      : <Plus size={15} className="text-brand-400 flex-shrink-0" />
                    }
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <button
                onClick={() => { setCompStep('url'); setCompetitorError(''); }}
                className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium"
              >
                <ExternalLink size={14} /> Pegar URL
              </button>
              <Button variant="secondary" onClick={() => { setModalOpen(false); resetModal(); }}>
                Cerrar
              </Button>
            </div>
          </div>
        )}

        {compStep === 'url' && (
          <form onSubmit={handleAddViaUrl} className="space-y-4">
            <Input
              label="URL del competidor"
              type="url"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              placeholder="https://www.mercadolibre.com.ar/..."
              hint="MercadoLibre, Amazon, Tiendanube y más"
              required
              autoFocus
            />
            {competitorError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{competitorError}</div>
            )}
            <div className="flex gap-3 justify-between">
              <Button type="button" variant="secondary" onClick={() => { setCompStep('search'); setCompetitorError(''); }}>← Buscar</Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetModal(); }}>Cancelar</Button>
                <Button type="submit" loading={addCompetitor.isPending}>
                  {addCompetitor.isPending ? 'Agregando...' : 'Agregar Competidor'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
