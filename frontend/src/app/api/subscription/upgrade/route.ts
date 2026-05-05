import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser, signAccessToken, signRefreshToken } from '@/lib/auth';

const VALID_TIERS = ['FREE', 'STARTER', 'GROWTH', 'PRO'];

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { tier } = await req.json();
  if (!tier || !VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('users')
    .update({ subscriptionTier: tier })
    .eq('id', user.id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'No se pudo actualizar el plan' }, { status: 500 });
  }

  // Re-issue tokens with new subscriptionTier embedded
  const accessToken = signAccessToken({ id: updated.id, email: updated.email, subscriptionTier: tier });
  const refreshToken = signRefreshToken(updated.id);

  return NextResponse.json({ success: true, tier, accessToken, refreshToken });
}
