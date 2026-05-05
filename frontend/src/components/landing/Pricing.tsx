import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For sellers just getting started',
    features: ['2 products', '5 competitors per product', 'Manual refresh', 'Price history (7 days)', 'No alerts'],
    cta: 'Get Started',
    href: '/signup',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: '$29',
    period: '/month',
    description: 'For growing ecommerce sellers',
    features: ['5 products', '20 competitors per product', 'Auto-refresh every 12h', 'Price history (30 days)', 'Email alerts', 'CSV export'],
    cta: 'Start Free Trial',
    href: '/signup?plan=STARTER',
    highlighted: true,
  },
  {
    name: 'Growth',
    price: '$79',
    period: '/month',
    description: 'For serious sellers with large catalogs',
    features: ['Unlimited products', '50 competitors per product', 'Smart alerts', 'Daily digest email', 'All Starter features', 'Priority support'],
    cta: 'Start Free Trial',
    href: '/signup?plan=GROWTH',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$199',
    period: '/month',
    description: 'For agencies and power users',
    features: ['Everything in Growth', 'REST API access', 'White-label reports', 'Unlimited competitors', 'Dedicated support', 'Custom integrations'],
    cta: 'Contact Sales',
    href: '/signup?plan=PRO',
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-xl text-gray-500">Start free. Upgrade when you need more power.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-xl border-2 p-6 flex flex-col ${
                plan.highlighted
                  ? 'border-brand-500 shadow-xl shadow-brand-100 relative'
                  : 'border-gray-200'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.period}</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check size={15} className="text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link href={plan.href}>
                <Button
                  variant={plan.highlighted ? 'primary' : 'secondary'}
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
