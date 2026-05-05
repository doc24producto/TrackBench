import Link from 'next/link';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { Pricing } from '@/components/landing/Pricing';
import { TrendingUp } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-brand-600" size={22} />
            <span className="font-bold text-gray-900">CompetitorTrack</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="#features" className="hover:text-gray-900 transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-16">
        <Hero />
        <Features />
        <Pricing />
      </main>

      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-brand-400" size={18} />
            <span className="text-white font-semibold">CompetitorTrack</span>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} CompetitorTrack. All rights reserved.</p>
          <div className="flex gap-4 text-sm">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
