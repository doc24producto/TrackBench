'use client';
import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';

export default function SignupPage() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await signup(name, email, password);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-brand-600 font-bold text-xl">
            <TrendingUp size={24} />
            CompetitorTrack
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6">Start tracking for free</h1>
          <p className="text-gray-500 mt-2">No credit card required</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              autoFocus
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              hint="At least 8 characters"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Create Account
            </Button>
          </form>

          <div className="mt-6 space-y-2">
            {['2 products free forever', 'No setup fees', 'Cancel anytime'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <Check size={14} className="text-green-500" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
