import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data } = await supabase.from('products')
    .select('*, competitors(* )')
    .eq('id', params.id).eq('userId', user.id).single();

  if (!data) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { name, sku } = await req.json();
  const { data, error } = await supabase.from('products')
    .update({ name, sku })
    .eq('id', params.id).eq('userId', user.id)
    .select().single();

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { error } = await supabase.from('products')
    .delete().eq('id', params.id).eq('userId', user.id);

  if (error) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ message: 'Producto eliminado' });
}
