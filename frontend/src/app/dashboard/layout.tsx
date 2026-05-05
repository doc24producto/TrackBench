'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { useAuthStore } from '@/store/authStore';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) router.push('/login');
  }, [accessToken, router]);

  if (!accessToken) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
