import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { signAccessToken, signRefreshToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
  }

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
  if (existing) return NextResponse.json({ error: 'El email ya está en uso' }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const { data: user, error } = await supabase.from('users').insert({
    email,
    password: hashed,
    name,
    subscriptionTier: 'FREE',
  }).select().single();

  if (error || !user) return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });

  await supabase.from('alert_settings').insert({ userId: user.id });

  const accessToken = signAccessToken({ id: user.id, email: user.email, subscriptionTier: user.subscriptionTier });
  const refreshToken = signRefreshToken(user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, subscriptionTier: user.subscriptionTier },
    accessToken,
    refreshToken,
  }, { status: 201 });
}
