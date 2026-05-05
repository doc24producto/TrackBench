'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/dashboard/Header';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

export default function SettingsPage() {
  const { user } = useAuthStore();
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
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (alertSettings) {
      setThreshold(String(alertSettings.priceChangeThreshold));
      setEmailAlerts(alertSettings.emailAlerts);
      setDailyDigest(alertSettings.dailyDigest);
    }
  }, [alertSettings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      await api.put('/api/alerts/settings', {
        emailAlerts,
        dailyDigest,
        priceChangeThreshold: parseFloat(threshold),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertSettings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleUpgrade = async (tier: string) => {
    const { data } = await api.post('/api/subscription/upgrade', { tier });
    if (data.url) window.location.href = data.url;
  };

  const tierOrder = ['FREE', 'STARTER', 'GROWTH', 'PRO'];
  const currentTierIndex = tierOrder.indexOf(user?.subscriptionTier || 'FREE');

  return (
    <div>
      <Header title="Settings" subtitle="Manage your account and notification preferences" />

      <div className="space-y-6">
        {/* Account */}
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Name</p>
              <p className="text-gray-900 mt-1">{user?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="text-gray-900 mt-1">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Plan</p>
              <Badge variant="info" className="mt-1">{user?.subscriptionTier}</Badge>
            </div>
          </div>
        </Card>

        {/* Subscription */}
        <Card id="subscription">
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <div className="space-y-4">
            {subscription && (
              <div className="text-sm text-gray-600">
                {subscription.subscription?.status === 'active' ? (
                  <p>Active until {new Date(subscription.subscription?.currentPeriodEnd).toLocaleDateString()}</p>
                ) : (
                  <p>Free plan — upgrade to unlock more features</p>
                )}
                <p className="mt-1">Products used: {subscription.usage?.products} / {subscription.limits?.maxProducts === Infinity ? '∞' : subscription.limits?.maxProducts}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { tier: 'STARTER', price: '$29/mo', features: '5 products, 20 competitors, alerts' },
                { tier: 'GROWTH', price: '$79/mo', features: 'Unlimited products, 50 competitors' },
                { tier: 'PRO', price: '$199/mo', features: 'Everything + API access' },
              ].map(({ tier, price, features }) => {
                const tierIdx = tierOrder.indexOf(tier);
                const isCurrent = tier === user?.subscriptionTier;
                const isDowngrade = tierIdx < currentTierIndex;
                return (
                  <div key={tier} className={`border rounded-lg p-4 ${isCurrent ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
                    <p className="font-semibold text-gray-900">{tier}</p>
                    <p className="text-lg font-bold text-brand-600 mt-1">{price}</p>
                    <p className="text-xs text-gray-500 mt-1">{features}</p>
                    {isCurrent ? (
                      <Badge variant="info" className="mt-3">Current Plan</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant={isDowngrade ? 'secondary' : 'primary'}
                        className="mt-3 w-full"
                        onClick={() => handleUpgrade(tier)}
                      >
                        {isDowngrade ? 'Downgrade' : 'Upgrade'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Email Alerts</p>
                <p className="text-sm text-gray-500">Receive email when competitor prices change</p>
              </div>
              <button
                onClick={() => setEmailAlerts(!emailAlerts)}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${emailAlerts ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${emailAlerts ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Daily Digest</p>
                <p className="text-sm text-gray-500">Get a daily summary email each morning</p>
              </div>
              <button
                onClick={() => setDailyDigest(!dailyDigest)}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${dailyDigest ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${dailyDigest ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <Input
              label="Price Change Threshold ($)"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              min="0.5"
              step="0.5"
              hint="Alert when competitor price changes by at least this amount"
            />
            <div className="flex items-center gap-3">
              <Button onClick={() => saveSettings.mutate()} loading={saveSettings.isPending}>
                Save Preferences
              </Button>
              {saved && <span className="text-sm text-green-600">Saved!</span>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
