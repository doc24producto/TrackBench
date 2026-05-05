import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { signAccessToken, signRefreshToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 400 });
  }

  const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
  if (!user?.password) return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });

  const accessToken = signAccessToken({ id: user.id, email: user.email, subscriptionTier: user.subscriptionTier });
  const refreshToken = signRefreshToken(user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, subscriptionTier: user.subscriptionTier },
    accessToken,
    refreshToken,
  });
}
