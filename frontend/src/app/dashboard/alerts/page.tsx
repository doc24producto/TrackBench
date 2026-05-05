'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, TrendingDown, TrendingUp as TrendingUpIcon } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/dashboard/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PriceAlert } from '@/types';
import api from '@/lib/api';

type Filter = 'all' | 'today' | 'week';

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');

  const { data: alerts = [], isLoading } = useQuery<PriceAlert[]>({
    queryKey: ['alerts', filter],
    queryFn: async () => {
      const { data } = await api.get(`/api/alerts${filter !== 'all' ? `?filter=${filter}` : ''}`);
      return data;
    },
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/alerts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return (
    <div>
      <Header title="Alerts" subtitle="Price change notifications for your tracked products" />

      <div className="flex gap-2 mb-6">
        {(['all', 'today', 'week'] as Filter[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-gray-200 animate-pulse" />
          ))}
        </div>
      ) : !alerts.length ? (
        <div className="text-center py-16">
          <Bell size={40} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No alerts yet</h3>
          <p className="text-gray-500 text-sm">
            Alerts are triggered when a competitor price changes by your threshold amount.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isLower = alert.alertType === 'price_lower';
            return (
              <Card key={alert.id} className={alert.isRead ? 'opacity-60' : ''}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isLower ? 'bg-red-100' : 'bg-green-100'}`}>
                    {isLower ? <TrendingDown size={18} className="text-red-600" /> : <TrendingUpIcon size={18} className="text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {alert.competitor?.name ?? 'Competitor'}{' '}
                          <span className={isLower ? 'text-red-600' : 'text-green-600'}>
                            {isLower ? 'lowered' : 'raised'} their price
                          </span>
                        </p>
                        {alert.competitor?.product && (
                          <p className="text-sm text-gray-500">
                            For:{' '}
                            <Link href={`/dashboard/products/${alert.competitor.product.id}`} className="text-brand-600 hover:underline">
                              {alert.competitor.product.name}
                            </Link>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Was → Now</p>
                          <p className="font-bold text-gray-900">
                            ${alert.oldPrice?.toFixed(2)} → <span className={isLower ? 'text-red-600' : 'text-green-600'}>${alert.newPrice?.toFixed(2)}</span>
                          </p>
                        </div>
                        <Badge variant={isLower ? 'danger' : 'success'}>
                          {isLower ? '↓' : '↑'} ${Math.abs((alert.newPrice ?? 0) - (alert.oldPrice ?? 0)).toFixed(2)}
                        </Badge>
                        <button
                          onClick={() => dismiss.mutate(alert.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                          title="Dismiss"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
