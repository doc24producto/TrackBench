import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { count: productCount } = await supabase.from('products')
    .select('*', { count: 'exact', head: true }).eq('userId', user.id);

  const { data: products } = await supabase.from('products')
    .select('id, currentPrice').eq('userId', user.id);

  const productIds = (products || []).map((p) => p.id);

  let competitorCount = 0;
  let marketAvg: number | null = null;

  if (productIds.length > 0) {
    const { count } = await supabase.from('competitors')
      .select('*', { count: 'exact', head: true }).in('productId', productIds);
    competitorCount = count ?? 0;

    const { data: comps } = await supabase.from('competitors')
      .select('currentPrice').in('productId', productIds).not('currentPrice', 'is', null);
    const prices = (comps || []).map((c) => c.currentPrice as number);
    if (prices.length > 0) marketAvg = prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  const yourPrices = (products || []).filter((p) => p.currentPrice !== null).map((p) => p.currentPrice as number);
  const yourAvg = yourPrices.length > 0 ? yourPrices.reduce((a, b) => a + b, 0) / yourPrices.length : null;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count: alertsToday } = await supabase.from('price_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('userId', user.id)
    .gte('createdAt', since.toISOString());

  return NextResponse.json({
    productCount: productCount ?? 0,
    competitorCount,
    alertsToday: alertsToday ?? 0,
    yourAveragePrice: yourAvg,
    marketAveragePrice: marketAvg,
    positionVsMarket: yourAvg && marketAvg
      ? yourAvg < marketAvg ? 'below' : yourAvg > marketAvg ? 'above' : 'equal'
      : null,
  });
}
