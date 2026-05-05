'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/dashboard/Header';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/authStore';
import { SubscriptionTier } from '@/types';
import api from '@/lib/api';

const TIER_LIMITS: Record<string, number> = {
  FREE: 3, STARTER: 10, GROWTH: 25, PRO: 100,
};

const PLANS = [
  { tier: 'STARTER', price: '$29/mes', features: '10 productos, 20 competidores, alertas' },
  { tier: 'GROWTH',  price: '$79/mes', features: '25 productos, 50 competidores' },
  { tier: 'PRO',     price: '$199/mes', features: 'Todo + acceso API' },
];

const tierOrder = ['FREE', 'STARTER', 'GROWTH', 'PRO'];

export default function SettingsPage() {
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: alertSettings } = useQuery({
    queryKey: ['alertSettings'],
    queryFn: async () => { const { data } = await api.get('/api/alerts/settings'); return data; },
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => { const { data } = await api.get('/api/subscription'); return data; },
  });

  const [threshold, setThreshold] = useState('5');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    if (alertSettings) {
      setThreshold(String(alertSettings.priceDropPct ?? 5));
      setEmailEnabled(alertSettings.emailEnabled ?? true);
    }
  }, [alertSettings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      await api.put('/api/alerts/settings', {
        emailEnabled,
        priceDropPct: parseFloat(threshold),
        priceRisePct: parseFloat(threshold),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertSettings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleUpgrade = async (tier: string) => {
    setUpgrading(tier);
    try {
      const { data } = await api.post('/api/subscription/upgrade', { tier });
      // Update store with new tokens so subscriptionTier takes effect immediately
      if (data.accessToken && user) {
        setAuth({ ...user, subscriptionTier: tier as SubscriptionTier }, data.accessToken, data.refreshToken);
      }
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch {
      alert('No se pudo cambiar el plan. Intentá de nuevo.');
    } finally {
      setUpgrading(null);
    }
  };

  const currentTier = user?.subscriptionTier || 'FREE';
  const currentTierIndex = tierOrder.indexOf(currentTier);
  const maxProducts = TIER_LIMITS[currentTier] ?? 3;
  const usedProducts = subscription?.usage?.products ?? 0;

  return (
    <div>
      <Header title="Configuración" subtitle="Manejá tu cuenta y preferencias" />

      <div className="space-y-6">
        {/* Cuenta */}
        <Card>
          <CardHeader><CardTitle>Cuenta</CardTitle></CardHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Nombre</p>
              <p className="text-gray-900 mt-1">{user?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="text-gray-900 mt-1">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Plan actual</p>
              <Badge variant="info" className="mt-1">{currentTier}</Badge>
            </div>
          </div>
        </Card>

        {/* Suscripción */}
        <Card id="subscription">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Suscripción</CardTitle>
              <span className="text-sm text-gray-500">
                {usedProducts}/{maxProducts === Infinity ? '∞' : maxProducts} productos usados
              </span>
            </div>
          </CardHeader>
          <div className="space-y-4">
            {currentTier === 'FREE' && (
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm text-brand-700">
                Estás en el plan gratuito. Subí de plan para monitorear más productos y competidores.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PLANS.map(({ tier, price, features }) => {
                const tierIdx = tierOrder.indexOf(tier);
                const isCurrent = tier === currentTier;
                const isDowngrade = tierIdx < currentTierIndex;
                return (
                  <div
                    key={tier}
                    className={`border rounded-xl p-4 transition-all ${isCurrent ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <p className="font-semibold text-gray-900">{tier}</p>
                    <p className="text-xl font-bold text-brand-600 mt-1">{price}</p>
                    <p className="text-xs text-gray-500 mt-1 mb-3">{features}</p>
                    {isCurrent ? (
                      <Badge variant="info">Plan actual</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant={isDowngrade ? 'secondary' : 'primary'}
                        className="w-full"
                        loading={upgrading === tier}
                        onClick={() => handleUpgrade(tier)}
                      >
                        {isDowngrade ? 'Bajar a este plan' : 'Subir a este plan'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Notificaciones */}
        <Card>
          <CardHeader><CardTitle>Notificaciones</CardTitle></CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Alertas por email</p>
                <p className="text-sm text-gray-500">Recibí un email cuando cambie el precio de un competidor</p>
              </div>
              <button
                onClick={() => setEmailEnabled(!emailEnabled)}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${emailEnabled ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${emailEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <Input
              label="Umbral de cambio de precio (%)"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              min="1"
              max="50"
              step="1"
              hint="Alertar cuando el precio cambia al menos este porcentaje"
            />

            <div className="flex items-center gap-3">
              <Button onClick={() => saveSettings.mutate()} loading={saveSettings.isPending}>
                Guardar preferencias
              </Button>
              {saved && <span className="text-sm text-green-600 font-medium">✓ Guardado</span>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
