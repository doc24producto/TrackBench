'use client';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

export function useAuth() {
  const { user, accessToken, setAuth, logout: storeLogout } = useAuthStore();
  const router = useRouter();

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    setAuth(data.user, data.accessToken, data.refreshToken);
    router.push('/dashboard');
  };

  const signup = async (name: string, email: string, password: string) => {
    const { data } = await api.post('/api/auth/signup', { name, email, password });
    setAuth(data.user, data.accessToken, data.refreshToken);
    router.push('/dashboard');
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    storeLogout();
    router.push('/login');
  };

  return { user, isAuthenticated: !!accessToken, login, signup, logout };
}
