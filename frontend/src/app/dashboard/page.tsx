'use client';
import { Package, Users, Bell, TrendingUp, Plus } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/dashboard/Header';
import { ProductCard } from '@/components/dashboard/ProductCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/Button';
import { useProducts, useDashboardSummary } from '@/hooks/useProducts';

export default function DashboardPage() {
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Monitor your products and competitors"
        actions={
          <Link href="/dashboard/products">
            <Button size="sm">
              <Plus size={16} /> Add Product
            </Button>
          </Link>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Products Tracked"
          value={summaryLoading ? '—' : summary?.productCount ?? 0}
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Competitors"
          value={summaryLoading ? '—' : summary?.competitorCount ?? 0}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Alerts Today"
          value={summaryLoading ? '—' : summary?.alertsToday ?? 0}
          icon={Bell}
          color="red"
        />
        <StatCard
          title="vs Market Average"
          value={summaryLoading ? '—' : summary?.positionVsMarket ?? 'N/A'}
          subtitle={summary?.positionVsMarket ? 'price difference' : 'Not enough data'}
          icon={TrendingUp}
          color="yellow"
        />
      </div>

      {/* Products grid */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Your Products</h2>
        <Link href="/dashboard/products" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
          View all
        </Link>
      </div>

      {productsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-40 animate-pulse" />
          ))}
        </div>
      ) : !products?.length ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-16 text-center">
          <Package size={40} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Add your first product</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            Paste an Amazon, MercadoLibre, or Shopify URL and we'll extract all product data automatically.
          </p>
          <Link href="/dashboard/products">
            <Button>
              <Plus size={16} /> Add Product
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
