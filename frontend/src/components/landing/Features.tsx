import { BarChart3, Bell, Search, Download, Shield, Zap } from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Auto-Detect Competitors',
    desc: 'Paste a product URL and we automatically find similar products across Amazon and MercadoLibre.',
  },
  {
    icon: BarChart3,
    title: 'Price History Charts',
    desc: 'Visualize 30-day price trends for your product and every competitor on a single chart.',
  },
  {
    icon: Bell,
    title: 'Instant Alerts',
    desc: 'Get email notifications the moment a competitor raises or lowers their price past your threshold.',
  },
  {
    icon: Zap,
    title: 'Real-Time Monitoring',
    desc: 'Prices are automatically refreshed every 12 hours across all tracked products and competitors.',
  },
  {
    icon: Download,
    title: 'Export Data',
    desc: 'Export all your pricing data to CSV for further analysis or reporting.',
  },
  {
    icon: Shield,
    title: 'Multi-Marketplace',
    desc: 'Supports Amazon (.com, .com.mx, .com.br), MercadoLibre, and any Shopify store.',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything you need to win on price</h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Built for ecommerce sellers in Latin America who want to stay ahead of the competition.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-md transition-all">
              <div className="w-11 h-11 bg-brand-50 rounded-lg flex items-center justify-center mb-4">
                <Icon size={20} className="text-brand-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
