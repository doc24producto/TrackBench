import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data } = await supabase.from('alert_settings')
    .select('*').eq('userId', user.id).single();

  return NextResponse.json(data || {});
}

export async function PUT(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { data } = await supabase.from('alert_settings')
    .upsert({ userId: user.id, ...body })
    .select().single();

  return NextResponse.json(data);
}
