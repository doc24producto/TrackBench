'use client';
import { Bell } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <Link href="/dashboard/alerts" className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={20} />
        </Link>
      </div>
    </div>
  );
}
