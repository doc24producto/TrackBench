'use client';
import { useState } from 'react';
import { Plus, Package, TrendingUp, Search, ExternalLink } from 'lucide-react';
import { Header } from '@/components/dashboard/Header';
import { ProductCard } from '@/components/dashboard/ProductCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useProducts } from '@/hooks/useProducts';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

const TIER_LIMITS: Record<string, number> = {
  FREE: 3, STARTER: 10, GROWTH: 25, PRO: 100,
};
const TIER_NEXT: Record<string, string> = {
  FREE: 'Starter', STARTER: 'Growth', GROWTH: 'Pro',
};

type Step = 'search' | 'url' | 'manual';

interface MLResult {
  id: string;
  title: string;
  price: number;
  currency: string;
  thumbnail: string;
  url: string;
}

export default function ProductsPage() {
  const { data: products, isLoading, error: productsError } = useProducts();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<Step>('search');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MLResult[]>([]);
  const [searching, setSearching] = useState(false);

  // URL / manual
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('ARS');

  const tier = user?.subscriptionTier ?? 'FREE';
  const limit = TIER_LIMITS[tier] ?? 3;
  const used = products?.length ?? 0;
  const remaining = Math.max(0, limit - used);
  const atLimit = used >= limit;
  const pct = Math.min(100, Math.round((used / limit) * 100));

  const resetModal = () => {
    setStep('search');
    setSearchQuery('');
    setSearchResults([]);
    setUrl('');
    setName('');
    setPrice('');
    setCurrency('ARS');
    setError('');
    setLoading(false);
  };

  const looksLikeUrl = (s: string) => /^https?:\/\//i.test(s.trim());

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // If the user pasted a URL, jump straight to the URL flow
    if (looksLikeUrl(q)) {
      setUrl(q);
      setStep('url');
      return;
    }

    setSearching(true);
    setError('');
    setSearchResults([]);
    try {
      const { data } = await api.get(`/api/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.results ?? []);
      if (!data.results?.length) setError('Sin resultados. Probá otra búsqueda o pegá la URL.');
    } catch {
      setError('Error al buscar. Pegá la URL directamente.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = async (result: MLResult) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/products', { url: result.url });
      if (data.scraped === false) {
        setUrl(result.url);
        setName(result.title);
        setPrice(String(result.price ?? ''));
        setCurrency(result.currency ?? 'ARS');
        if (data.error) setError(data.error);
        setStep('manual');
      } else {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setModalOpen(false);
        resetModal();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg || 'Error al agregar el producto.');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/products', { url });
      if (data.scraped === false) {
        if (data.error) setError(data.error);
        setStep('manual');
      } else {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setModalOpen(false);
        resetModal();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg || 'Error al procesar la URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true);
    try {
      await api.post('/api/products', { url, name, price, currency });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      resetModal();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg || 'Error al guardar el producto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header
        title="Productos"
        subtitle="Monitoreá tus productos y comparalos con el mercado"
        actions={
          <Button
            onClick={() => { setModalOpen(true); resetModal(); }}
            disabled={atLimit}
            title={atLimit ? `Límite del plan ${tier} alcanzado` : undefined}
          >
            <Plus size={16} /> Agregar Producto
          </Button>
        }
      />

      {productsError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <p className="font-semibold text-red-700">Error al cargar productos</p>
          <p className="text-red-600 mt-1">{productsError.message}</p>
        </div>
      )}

      {!isLoading && (
        <div className={`mb-6 rounded-xl border p-4 ${atLimit ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                Plan <span className="text-brand-600 font-semibold">{tier}</span>
              </span>
              <span className={`text-sm font-bold ${atLimit ? 'text-red-600' : 'text-gray-900'}`}>
                {used}/{limit} productos
              </span>
            </div>
            {tier !== 'PRO' && (
              <button className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
                <TrendingUp size={12} /> Subir a {TIER_NEXT[tier] ?? 'Pro'}
              </button>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${atLimit ? 'bg-red-500' : pct >= 66 ? 'bg-yellow-400' : 'bg-brand-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {atLimit
              ? 'Límite alcanzado. Eliminá un producto o subí de plan.'
              : `${remaining} ${remaining === 1 ? 'producto disponible' : 'productos disponibles'}`}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-xl border border-gray-200 h-44 animate-pulse" />)}
        </div>
      ) : !products?.length ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-16 text-center">
          <Package size={40} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Todavía no tenés productos</h3>
          <p className="text-gray-500 text-sm mb-6">
            Buscá por nombre o EAN/GTIN, o pegá una URL de MercadoLibre, Amazon o cualquier tienda.
          </p>
          <Button onClick={() => { setModalOpen(true); resetModal(); }}>
            <Plus size={16} /> Agregar tu primer producto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetModal(); }}
        title={step === 'manual' ? 'Completar datos del producto' : 'Agregar Producto'}
      >
        {/* Step: Search */}
        {step === 'search' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Buscá por nombre, marca o EAN/GTIN — o pegá la URL directamente.
            </p>

            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nombre, EAN o pegar URL directamente..."
                  autoFocus
                />
              </div>
              <Button type="submit" loading={searching} disabled={!searchQuery.trim()}>
                <Search size={16} />
              </Button>
            </form>

            {error && !searchResults.length && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{error}</p>
            )}

            {searchResults.length > 0 && (
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectResult(result)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 p-3 hover:bg-brand-50 transition-colors text-left disabled:opacity-50"
                  >
                    {result.thumbnail && (
                      <img src={result.thumbnail} alt={result.title} className="w-12 h-12 object-contain rounded-lg flex-shrink-0 bg-gray-50 border border-gray-100" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm line-clamp-2 leading-snug">{result.title}</p>
                      <p className="text-brand-600 font-bold text-sm mt-1">
                        {result.currency} ${result.price?.toLocaleString('es-AR')}
                      </p>
                    </div>
                    <Plus size={16} className="text-brand-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <p className="text-center text-sm text-gray-500 py-2">Agregando producto...</p>
            )}

            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <button
                onClick={() => { setStep('url'); setError(''); }}
                className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium"
              >
                <ExternalLink size={14} /> Pegar URL
              </button>
              <Button variant="secondary" onClick={() => { setModalOpen(false); resetModal(); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Step: URL */}
        {step === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <Input
              label="URL del producto"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.mercadolibre.com.ar/..."
              hint="MercadoLibre, Amazon, Shopify, Tiendanube y más"
              required
              autoFocus
            />
            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
            <div className="flex gap-3 justify-between">
              <Button type="button" variant="secondary" onClick={() => { setStep('search'); setError(''); }}>← Buscar</Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetModal(); }}>Cancelar</Button>
                <Button type="submit" loading={loading}>{loading ? 'Extrayendo...' : 'Continuar'}</Button>
              </div>
            </div>
          </form>
        )}

        {/* Step: Manual */}
        {step === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              <p className="font-medium mb-0.5">Completá los datos manualmente</p>
              <p>{error || 'Guardamos la URL para monitorear cambios de precio automáticamente.'}</p>
            </div>

            {url && <div className="text-xs text-gray-400 bg-gray-50 rounded p-2 truncate">{url}</div>}

            <Input
              label="Nombre del producto *"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Samsung Galaxy S24 256GB"
              required
              autoFocus
            />

            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  label="Precio actual"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="ej: 1200000"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ARS">ARS $</option>
                  <option value="USD">USD $</option>
                  <option value="BRL">BRL R$</option>
                  <option value="MXN">MXN $</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={() => { setStep('search'); setError(''); }}>← Volver</Button>
              <Button type="submit" loading={loading}>Guardar Producto</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
