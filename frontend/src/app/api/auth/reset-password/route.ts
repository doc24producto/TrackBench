import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';

interface ResetPayload {
  id: string;
  email: string;
  purpose: string;
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: 'Token y contraseña requeridos' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }

  let payload: ResetPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as ResetPayload;
  } catch {
    return NextResponse.json({ error: 'El link expiró o es inválido. Pedí uno nuevo.' }, { status: 400 });
  }

  if (payload.purpose !== 'password_reset') {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);

  const { error } = await supabase
    .from('users')
    .update({ password: hashed })
    .eq('id', payload.id)
    .eq('email', payload.email);

  if (error) {
    console.error('[reset-password] Supabase update error:', error);
    return NextResponse.json({ error: 'Error al actualizar la contraseña' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
