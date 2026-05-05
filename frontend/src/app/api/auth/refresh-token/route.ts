import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { refreshToken } = await req.json();
  if (!refreshToken) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

  const { data: user } = await supabase.from('users').select('*').eq('id', payload.id).single();
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  return NextResponse.json({
    accessToken: signAccessToken({ id: user.id, email: user.email, subscriptionTier: user.subscriptionTier }),
    refreshToken: signRefreshToken(user.id),
  });
}
