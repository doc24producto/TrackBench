'use client';
import { useState } from 'react';
import { Plus, Package, AlertCircle, TrendingUp } from 'lucide-react';
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

type Step = 'url' | 'manual';

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<Step>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setStep('url');
    setUrl('');
    setName('');
    setPrice('');
    setCurrency('ARS');
    setError('');
    setLoading(false);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/products', { url });
      if (data.scraped === false) {
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
        subtitle="Gestioná los productos que estás monitoreando"
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

      {/* ── Barra de uso del plan ── */}
      {!isLoading && (
        <div className={`mb-6 rounded-xl border p-4 ${atLimit ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                Productos en tu plan <span className="text-brand-600 font-semibold">{tier}</span>
              </span>
              <span className={`text-sm font-bold ${atLimit ? 'text-red-600' : 'text-gray-900'}`}>
                {used}/{limit}
              </span>
            </div>
            {tier !== 'PRO' && (
              <button className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
                <TrendingUp size={12} />
                Subir a {TIER_NEXT[tier] ?? 'Pro'}
              </button>
            )}
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                atLimit ? 'bg-red-500' : pct >= 66 ? 'bg-yellow-400' : 'bg-brand-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {atLimit ? (
            <p className="text-xs text-red-600 mt-2">
              Llegaste al límite de tu plan. Eliminá un producto para agregar otro, o subí de plan para monitorear más.
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-2">
              {remaining} {remaining === 1 ? 'producto disponible' : 'productos disponibles'} en tu plan actual.
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-40 animate-pulse" />
          ))}
        </div>
      ) : !products?.length ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-16 text-center">
          <Package size={40} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Todavía no tenés productos</h3>
          <p className="text-gray-500 text-sm mb-6">Pegá una URL de MercadoLibre, Amazon o cualquier tienda para empezar.</p>
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

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetModal(); }}
        title={step === 'url' ? 'Agregar Producto' : 'Completar datos del producto'}
      >
        {step === 'url' ? (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <Input
              label="URL del producto"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.mercadolibre.com.ar/..."
              hint="Pegá la URL de un producto de MercadoLibre, Amazon o cualquier tienda"
              required
              autoFocus
            />
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
            )}
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetModal(); }}>Cancelar</Button>
              <Button type="submit" loading={loading}>
                {loading ? 'Extrayendo datos...' : 'Continuar'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <AlertCircle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-700">
                No pudimos leer los datos automáticamente. Ingresalos a mano — igual guardamos la URL para monitorear cambios.
              </p>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 truncate">{url}</div>

            <Input
              label="Nombre del producto *"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Smart TV Noblex 32"
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
                  placeholder="ej: 150000"
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

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
            )}
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={() => setStep('url')}>← Volver</Button>
              <Button type="submit" loading={loading}>Guardar Producto</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
