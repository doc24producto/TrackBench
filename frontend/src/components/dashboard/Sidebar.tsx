'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Bell, Settings, TrendingUp, LogOut, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/products', icon: Package, label: 'Products' },
  { href: '/dashboard/alerts', icon: Bell, label: 'Alerts' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-brand-600" size={24} />
          <span className="font-bold text-gray-900 text-lg">CompetitorTrack</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {user?.subscriptionTier === 'FREE' && (
        <div className="p-4">
          <div className="bg-brand-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-brand-600" />
              <span className="text-sm font-medium text-brand-700">Upgrade Plan</span>
            </div>
            <p className="text-xs text-brand-600 mb-3">Unlock more products, competitors & alerts</p>
            <Link
              href="/dashboard/settings#subscription"
              className="block w-full text-center bg-brand-600 text-white text-xs font-medium py-2 px-3 rounded-lg hover:bg-brand-700 transition-colors"
            >
              Upgrade Now
            </Link>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-brand-700">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.subscriptionTier}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
