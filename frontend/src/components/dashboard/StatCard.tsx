import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'red' | 'yellow';
}

const colors = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  green: { bg: 'bg-green-50', text: 'text-green-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600' },
};

export function StatCard({ title, value, subtitle, icon: Icon, color = 'blue' }: StatCardProps) {
  const c = colors[color];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon size={22} className={c.text} />
        </div>
      </div>
    </Card>
  );
}
