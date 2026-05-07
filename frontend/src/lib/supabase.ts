import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  // Log clearly so Vercel/Railway logs make the problem obvious
  console.error(
    '[Supabase] ⚠️  Missing env vars.',
    'SUPABASE_URL:', url ? '✓' : '✗ MISSING',
    '| SUPABASE_SERVICE_ROLE_KEY:', key ? '✓' : '✗ MISSING',
    '\nSet these in your Vercel / .env.local and redeploy.'
  );
}

export const supabase = createClient(
  url ?? 'http://localhost',
  key ?? 'placeholder-key-set-env-vars',
);
