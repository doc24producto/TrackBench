import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: product } = await supabase.from('products')
    .select('id').eq('id', params.id).eq('userId', user.id).single();
  if (!product) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase.from('price_history')
    .select('*')
    .eq('productId', params.id)
    .gte('recordedAt', since.toISOString())
    .order('recordedAt', { ascending: true });

  return NextResponse.json(data || []);
}
