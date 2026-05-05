import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data } = await supabase.from('price_alerts')
    .select('*, competitor:competitors(*, product:products(id, name))')
    .eq('userId', user.id)
    .order('createdAt', { ascending: false })
    .limit(50);

  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { ids } = await req.json();
  await supabase.from('price_alerts')
    .update({ isRead: true })
    .eq('userId', user.id)
    .in('id', ids || []);

  return NextResponse.json({ message: 'Actualizadas' });
}
