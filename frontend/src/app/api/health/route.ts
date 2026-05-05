import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // Env vars
  checks.env = {
    ok: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.JWT_SECRET,
    detail: [
      process.env.SUPABASE_URL ? '✓ SUPABASE_URL' : '✗ SUPABASE_URL missing',
      process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ SUPABASE_SERVICE_ROLE_KEY' : '✗ SUPABASE_SERVICE_ROLE_KEY missing',
      process.env.JWT_SECRET ? '✓ JWT_SECRET' : '✗ JWT_SECRET missing',
      process.env.JWT_REFRESH_SECRET ? '✓ JWT_REFRESH_SECRET' : '✗ JWT_REFRESH_SECRET missing',
    ].join(' | '),
  };

  // Exact GET /api/products query (no user filter — just to test columns + order)
  const { error: q1 } = await supabase
    .from('products')
    .select('*, competitors(id, name, currentPrice, currency)')
    .order('createdAt', { ascending: false })
    .limit(1);
  checks['query:products_with_order'] = {
    ok: !q1,
    detail: q1 ? `${q1.code}: ${q1.message}` : 'ok',
  };

  // Test eq on userId column specifically
  const { error: q2 } = await supabase
    .from('products')
    .select('id')
    .eq('userId', '00000000-0000-0000-0000-000000000000')
    .limit(1);
  checks['query:products_eq_userId'] = {
    ok: !q2,
    detail: q2 ? `${q2.code}: ${q2.message}` : 'ok (column exists)',
  };

  // Test order on competitors
  const { error: q3 } = await supabase
    .from('competitors')
    .select('id, name, currentPrice, currency')
    .limit(1);
  checks['query:competitors_columns'] = {
    ok: !q3,
    detail: q3 ? `${q3.code}: ${q3.message}` : 'ok',
  };

  // Test dashboard summary query
  const { error: q4 } = await supabase
    .from('price_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('userId', '00000000-0000-0000-0000-000000000000')
    .gte('createdAt', new Date().toISOString());
  checks['query:price_alerts_createdAt'] = {
    ok: !q4,
    detail: q4 ? `${q4.code}: ${q4.message}` : 'ok',
  };

  // Column names via information_schema
  const { data: colData, error: colErr } = await supabase
    .rpc('version'); // just to test RPC works
  void colData; void colErr;

  // Direct column list
  const { data: productRow } = await supabase.from('products').select('*').limit(1);
  checks['columns:products'] = {
    ok: true,
    detail: productRow?.[0] ? Object.keys(productRow[0]).join(', ') : 'no rows — cannot inspect columns',
  };

  const { data: compRow } = await supabase.from('competitors').select('*').limit(1);
  checks['columns:competitors'] = {
    ok: true,
    detail: compRow?.[0] ? Object.keys(compRow[0]).join(', ') : 'no rows — cannot inspect columns',
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 500 });
}
