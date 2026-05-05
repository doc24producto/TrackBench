import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: comp } = await supabase.from('competitors')
    .select('id, product:products(userId)').eq('id', params.id).single();

  const product = comp?.product as unknown as { userId: string } | null;
  if (!comp || product?.userId !== user.id) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  await supabase.from('competitors').delete().eq('id', params.id);
  return NextResponse.json({ message: 'Eliminado' });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { name } = await req.json();
  const { data } = await supabase.from('competitors')
    .update({ name }).eq('id', params.id).select().single();

  return NextResponse.json(data);
}
