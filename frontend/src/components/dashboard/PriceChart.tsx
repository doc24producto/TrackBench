'use client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { PriceHistory } from '@/types';

interface PriceChartProps {
  productHistory: PriceHistory[];
  competitorHistories?: { name: string; history: PriceHistory[] }[];
}

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2'];

export function PriceChart({ productHistory, competitorHistories = [] }: PriceChartProps) {
  const allDates = new Set<string>();
  const dateMap: Record<string, Record<string, number>> = {};

  productHistory.forEach(({ recordedAt, price }) => {
    const d = new Date(recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    allDates.add(d);
    if (!dateMap[d]) dateMap[d] = {};
    dateMap[d]['Your Price'] = price;
  });

  competitorHistories.forEach(({ name, history }) => {
    history.forEach(({ recordedAt, price }) => {
      const d = new Date(recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      allDates.add(d);
      if (!dateMap[d]) dateMap[d] = {};
      dateMap[d][name] = price;
    });
  });

  const data = Array.from(allDates)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map((date) => ({ date, ...dateMap[date] }));

  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        No price history yet
      </div>
    );
  }

  const keys = ['Your Price', ...competitorHistories.map((c) => c.name)];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`]} />
        <Legend />
        {keys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={key === 'Your Price' ? 2.5 : 1.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
