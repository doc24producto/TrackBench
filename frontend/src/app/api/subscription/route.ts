import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';

const TIER_LIMITS: Record<string, number> = {
  FREE: 3, STARTER: 10, GROWTH: 25, PRO: 100,
};

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('userId', user.id);

  const maxProducts = TIER_LIMITS[user.subscriptionTier] ?? 3;

  return NextResponse.json({
    tier: user.subscriptionTier,
    subscription: {
      status: user.subscriptionTier === 'FREE' ? 'free' : 'active',
    },
    usage: {
      products: productCount ?? 0,
    },
    limits: {
      maxProducts,
    },
  });
}
