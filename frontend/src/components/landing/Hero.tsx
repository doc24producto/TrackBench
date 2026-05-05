import Link from 'next/link';
import { TrendingUp, ArrowRight, BarChart3, Bell, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white">
      <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,white)]" />
      <div className="relative max-w-6xl mx-auto px-6 py-24 lg:py-32">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm mb-8 backdrop-blur-sm">
            <TrendingUp size={14} />
            Real-time competitor price monitoring
          </div>

          <h1 className="text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            Know your competitors'
            <span className="block text-yellow-300">prices before they move</span>
          </h1>

          <p className="text-xl text-brand-200 mb-10 leading-relaxed">
            Monitor Amazon, MercadoLibre & Shopify competitors in real time. Get instant alerts when prices change and make smarter pricing decisions.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-brand-700 hover:bg-brand-50 font-bold shadow-lg">
                Get Started Free <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="#pricing">
              <Button size="lg" variant="ghost" className="text-white border border-white/30 hover:bg-white/10">
                View Pricing
              </Button>
            </Link>
          </div>

          <p className="text-brand-300 text-sm mt-6">No credit card required · Free tier available</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20">
          {[
            { icon: BarChart3, title: 'Price History', desc: '30-day price trends for every competitor' },
            { icon: Bell, title: 'Smart Alerts', desc: 'Email notifications when prices change ±$5' },
            { icon: Globe, title: 'Multi-Channel', desc: 'Amazon, MercadoLibre & Shopify support' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <Icon size={24} className="text-yellow-300 mb-3" />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-brand-200">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
