'use client';
import Link from 'next/link';
import { ExternalLink, Trash2, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Product } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useDeleteProduct } from '@/hooks/useProducts';
import api from '@/lib/api';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
}

/** Market position relative to competitors */
function MarketPosition({ product }: { product: Product }) {
  const competitors = product.competitors ?? [];
  const prices = competitors.map((c) => c.currentPrice).filter((p): p is number => p !== null && p > 0);
  if (!prices.length || !product.currentPrice) return null;

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const myPrice = product.currentPrice;
  const diffPct = ((myPrice - avgPrice) / avgPrice) * 100;

  const isCheapest = myPrice <= minPrice;
  const isMostExpensive = myPrice >= maxPrice;

  if (isCheapest) {
    return (
      <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
        <TrendingDown size={12} /> Precio más bajo del mercado
      </div>
    );
  }
  if (isMostExpensive) {
    return (
      <div className="flex items-center gap-1 text-red-500 text-xs font-medium">
        <TrendingUp size={12} /> {Math.abs(diffPct).toFixed(0)}% por encima del promedio
      </div>
    );
  }
  if (Math.abs(diffPct) < 2) {
    return (
      <div className="flex items-center gap-1 text-gray-500 text-xs">
        <Minus size={12} /> En línea con el mercado
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${diffPct < 0 ? 'text-green-600' : 'text-amber-600'}`}>
      {diffPct < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
      {Math.abs(diffPct).toFixed(0)}% {diffPct < 0 ? 'por debajo' : 'por encima'} del promedio
    </div>
  );
}

export function ProductCard({ product }: ProductCardProps) {
  const deleteProduct = useDeleteProduct();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post(`/api/products/${product.id}/refresh`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = () => {
    if (confirm(`¿Eliminar "${product.name}"?\n\nEsta acción no se puede deshacer.`)) {
      deleteProduct.mutate(product.id);
    }
  };

  const competitorCount = product._count?.competitors ?? product.competitors?.length ?? 0;

  return (
    <Card padding={false} className="overflow-hidden hover:shadow-md transition-all duration-200 group">
      <div className="flex gap-4 p-4">
        {/* Product image */}
        <div className="w-20 h-20 bg-gray-50 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-1" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-medium">
              Sin imagen
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{product.name}</h3>
            {(() => {
              const mp = (product.marketplace ?? '').toLowerCase();
              const variant = mp.includes('mercado') ? 'success' : mp.includes('amazon') ? 'warning' : 'info';
              return (
                <Badge variant={variant} className="flex-shrink-0 text-xs">
                  {product.marketplace}
                </Badge>
              );
            })()}
          </div>

          {product.currentPrice ? (
            <p className="text-2xl font-extrabold text-gray-900 tabular-nums">
              <span className="text-sm font-normal text-gray-500 mr-0.5">{product.currency}</span>
              ${product.currentPrice.toLocaleString('es-AR')}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic mt-1">Sin precio aún</p>
          )}

          <div className="mt-2 space-y-1">
            <MarketPosition product={product} />
            <p className="text-xs text-gray-400">
              {competitorCount} {competitorCount === 1 ? 'competidor' : 'competidores'} monitoreados
            </p>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <Link href={`/dashboard/products/${product.id}`} className="flex-1">
          <Button variant="primary" size="sm" className="w-full text-xs">
            Ver análisis
          </Button>
        </Link>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-40"
          title="Actualizar precios"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
          title="Ver en tienda"
        >
          <ExternalLink size={14} />
        </a>
        <button
          onClick={handleDelete}
          disabled={deleteProduct.isPending}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
          title="Eliminar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  );
}
