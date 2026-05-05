'use client';
import { ExternalLink, Trash2, Star } from 'lucide-react';
import { Competitor, Product } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { useDeleteCompetitor } from '@/hooks/useProducts';
import { clsx } from 'clsx';

interface CompetitorTableProps {
  product: Product;
  competitors: Competitor[];
}

export function CompetitorTable({ product, competitors }: CompetitorTableProps) {
  const deleteCompetitor = useDeleteCompetitor(product.id);

  if (!competitors.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No competitors tracked yet.</p>
        <p className="text-sm mt-1">Click &quot;+ Add Competitor&quot; to start monitoring.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Rank</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Competitor</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Price</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">vs Yours</th>
            <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Rating</th>
            <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Reviews</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Platform</th>
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {competitors.map((c, index) => {
            const cheaper = product.currentPrice && c.currentPrice && c.currentPrice < product.currentPrice;
            const priceDiff = product.currentPrice && c.currentPrice ? c.currentPrice - product.currentPrice : null;

            return (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 text-gray-500 font-medium">#{index + 1}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {c.imageUrl && (
                      <img src={c.imageUrl} alt={c.name} className="w-8 h-8 object-contain rounded" />
                    )}
                    <span className="font-medium text-gray-900 line-clamp-1 max-w-[200px]">{c.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={clsx('font-bold', cheaper ? 'text-red-600' : 'text-green-600')}>
                    {c.currentPrice ? `$${c.currentPrice.toFixed(2)}` : '—'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  {priceDiff !== null ? (
                    <Badge variant={priceDiff < 0 ? 'danger' : 'success'}>
                      {priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(2)}
                    </Badge>
                  ) : '—'}
                </td>
                <td className="py-3 px-4 text-center">
                  {c.rating ? (
                    <span className="flex items-center justify-center gap-1 text-yellow-500">
                      <Star size={13} fill="currentColor" />
                      {c.rating.toFixed(1)}
                    </span>
                  ) : '—'}
                </td>
                <td className="py-3 px-4 text-center text-gray-600">
                  {c.reviewCount?.toLocaleString() || '—'}
                </td>
                <td className="py-3 px-4">
                  <Badge variant="default">{c.marketplace}</Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${c.name}"?`)) deleteCompetitor.mutate(c.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
