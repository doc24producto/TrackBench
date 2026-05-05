'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, RefreshCw, ExternalLink } from 'lucide-react';
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

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: product, isLoading, error } = useProduct(id);
  const { data: priceHistory = [] } = usePriceHistory(id);
  const addCompetitor = useAddCompetitor(id);

  const [modalOpen, setModalOpen] = useState(false);
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [competitorError, setCompetitorError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompetitorError('');
    try {
      await addCompetitor.mutateAsync(competitorUrl);
      setCompetitorUrl('');
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setCompetitorError(msg || 'Failed to add competitor.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post(`/api/products/${id}/refresh`);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-48 bg-white rounded-xl border border-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Product not found.</p>
        <Button variant="secondary" onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const competitors = product.competitors || [];
  const competitorPrices = competitors.map((c) => c.currentPrice).filter(Boolean) as number[];
  const marketAvg = competitorPrices.length
    ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/products">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Back</Button>
        </Link>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
          <RefreshCw size={15} /> Refresh
        </Button>
        <a href={product.url} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" size="sm">
            <ExternalLink size={15} /> View Listing
          </Button>
        </a>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add Competitor
        </Button>
      </div>

      {/* Product info */}
      <Card>
        <div className="flex gap-6 items-start">
          {product.imageUrl && (
            <img src={product.imageUrl} alt={product.name} className="w-24 h-24 object-contain rounded-lg border border-gray-100" />
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h1>
              <Badge variant="info">{product.marketplace}</Badge>
            </div>
            {product.sku && <p className="text-sm text-gray-500 mt-1">SKU: {product.sku}</p>}
            <div className="flex items-end gap-6 mt-4">
              <div>
                <p className="text-xs text-gray-500">Your Price</p>
                <p className="text-3xl font-extrabold text-gray-900">
                  {product.currentPrice ? `$${product.currentPrice.toFixed(2)}` : 'N/A'}
                </p>
              </div>
              {marketAvg && (
                <div>
                  <p className="text-xs text-gray-500">Market Average</p>
                  <p className="text-2xl font-bold text-gray-600">${marketAvg.toFixed(2)}</p>
                </div>
              )}
              {product.currentPrice && marketAvg && (
                <div>
                  <p className="text-xs text-gray-500">Your Position</p>
                  <Badge variant={product.currentPrice > marketAvg ? 'danger' : 'success'} className="text-sm">
                    {((product.currentPrice - marketAvg) / marketAvg * 100).toFixed(1)}% vs market
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Price history chart */}
      <Card>
        <CardHeader>
          <CardTitle>Price History (30 days)</CardTitle>
        </CardHeader>
        <PriceChart
          productHistory={priceHistory}
          competitorHistories={competitors.slice(0, 5).map((c) => ({ name: c.name.slice(0, 20), history: [] }))}
        />
      </Card>

      {/* Competitors table */}
      <Card padding={false}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Competitors</h2>
            <p className="text-sm text-gray-500">{competitors.length} tracked · sorted by price</p>
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Add
          </Button>
        </div>
        <CompetitorTable product={product} competitors={competitors} />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setCompetitorError(''); setCompetitorUrl(''); }}
        title="Add Competitor"
      >
        <form onSubmit={handleAddCompetitor} className="space-y-4">
          <Input
            label="Competitor URL"
            type="url"
            value={competitorUrl}
            onChange={(e) => setCompetitorUrl(e.target.value)}
            placeholder="https://www.amazon.com/dp/..."
            hint="Paste a competitor's product URL on Amazon, MercadoLibre, or Shopify"
            required
            autoFocus
          />
          {competitorError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{competitorError}</div>
          )}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={addCompetitor.isPending}>
              {addCompetitor.isPending ? 'Extracting...' : 'Add Competitor'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
