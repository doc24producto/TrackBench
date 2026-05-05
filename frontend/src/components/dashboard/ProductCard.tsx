'use client';
import Link from 'next/link';
import { ExternalLink, Trash2, RefreshCw } from 'lucide-react';
import { Product } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useDeleteProduct } from '@/hooks/useProducts';
import api from '@/lib/api';

interface ProductCardProps {
  product: Product;
}

const marketplaceColors: Record<string, 'info' | 'warning' | 'success'> = {
  amazon: 'warning',
  mercadolibre: 'success',
  shopify: 'info',
};

export function ProductCard({ product }: ProductCardProps) {
  const deleteProduct = useDeleteProduct();

  const handleRefresh = async () => {
    await api.post(`/api/products/${product.id}/refresh`);
  };

  const handleDelete = () => {
    if (confirm(`Delete "${product.name}"?`)) {
      deleteProduct.mutate(product.id);
    }
  };

  return (
    <Card padding={false} className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex gap-4 p-4">
        <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No image</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-gray-900 truncate text-sm leading-5">{product.name}</h3>
            <Badge variant={marketplaceColors[product.marketplace] || 'default'}>
              {product.marketplace}
            </Badge>
          </div>

          {product.currentPrice && (
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {product.currency} ${product.currentPrice.toFixed(2)}
            </p>
          )}

          <p className="text-xs text-gray-500 mt-1">
            {product._count?.competitors ?? product.competitors?.length ?? 0} competitors tracked
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
        <Link href={`/dashboard/products/${product.id}`} className="flex-1">
          <Button variant="primary" size="sm" className="w-full">View Details</Button>
        </Link>
        <button
          onClick={handleRefresh}
          className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
          title="Open in marketplace"
        >
          <ExternalLink size={15} />
        </a>
        <button
          onClick={handleDelete}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </Card>
  );
}
