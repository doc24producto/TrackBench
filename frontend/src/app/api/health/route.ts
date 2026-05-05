import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // Check env vars
  checks.env = {
    ok: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.JWT_SECRET,
    detail: [
      process.env.SUPABASE_URL ? '✓ SUPABASE_URL' : '✗ SUPABASE_URL missing',
      process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ SUPABASE_SERVICE_ROLE_KEY' : '✗ SUPABASE_SERVICE_ROLE_KEY missing',
      process.env.JWT_SECRET ? '✓ JWT_SECRET' : '✗ JWT_SECRET missing',
      process.env.JWT_REFRESH_SECRET ? '✓ JWT_REFRESH_SECRET' : '✗ JWT_REFRESH_SECRET missing',
    ].join(' | '),
  };

  // Check real query on products (the one that actually fails)
  const { data: productsTest, error: productsError } = await supabase
    .from('products')
    .select('*, competitors(id, name, currentPrice, currency)')
    .limit(1);

  checks['query:products+competitors'] = {
    ok: !productsError,
    detail: productsError ? `${productsError.code}: ${productsError.message}` : `ok (${productsTest?.length ?? 0} rows)`,
  };

  // Check column names on products table
  const { data: cols, error: colsError } = await supabase
    .rpc('get_columns', { table_name: 'products' })
    .limit(30);

  if (colsError) {
    // rpc doesn't exist, try information_schema directly
    const { data: schema } = await supabase
      .from('products')
      .select('*')
      .limit(0);
    checks['columns:products'] = {
      ok: true,
      detail: schema !== null ? 'query ok (check nested query error above for column issues)' : 'could not read',
    };
  } else {
    checks['columns:products'] = { ok: true, detail: JSON.stringify(cols) };
  }

  // Check real query on users
  const { error: usersError } = await supabase
    .from('users')
    .select('id, email, subscriptionTier')
    .limit(1);

  checks['query:users'] = {
    ok: !usersError,
    detail: usersError ? `${usersError.code}: ${usersError.message}` : 'ok',
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 500 });
}
