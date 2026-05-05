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

  // Check Supabase connection + tables
  const tables = ['users', 'products', 'competitors', 'price_history', 'price_alerts', 'alert_settings'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    checks[`table:${table}`] = {
      ok: !error,
      detail: error ? `${error.code}: ${error.message}` : 'exists',
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 500 });
}
