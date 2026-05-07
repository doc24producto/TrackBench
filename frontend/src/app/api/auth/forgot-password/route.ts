import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';

// Reset tokens are signed JWTs — no DB column needed.
// They expire in 30 minutes and carry {id, email, purpose}.

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 });

  // Always respond 200 regardless of whether the email exists (security: no user enumeration)
  const { data: user } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (user) {
    const resetToken = jwt.sign(
      { id: user.id, email: user.email, purpose: 'password_reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '30m' }
    );

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Try to send a real email if RESEND_API_KEY is set; otherwise log to console (dev mode)
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? 'CompetitorTrack <noreply@competitortrack.com>',
            to: user.email,
            subject: 'Resetear contraseña — CompetitorTrack',
            html: buildEmailHtml(user.name, resetUrl),
          }),
        });
      } catch (e) {
        console.error('[forgot-password] Email send failed:', e);
      }
    } else {
      // Development fallback — print the link so you can test without email creds
      console.log('\n──────────────────────────────────────────');
      console.log('[DEV] Password reset link for', user.email);
      console.log(resetUrl);
      console.log('──────────────────────────────────────────\n');
    }
  }

  return NextResponse.json({ ok: true });
}

function buildEmailHtml(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb;">
    <h2 style="margin:0 0 8px;color:#111827;">Hola, ${name || 'usuario'} 👋</h2>
    <p style="color:#6b7280;margin:0 0 24px;">
      Recibimos un pedido para resetear la contraseña de tu cuenta en CompetitorTrack.
      Hacé click en el botón de abajo — el link expira en <strong>30 minutos</strong>.
    </p>
    <a href="${resetUrl}"
       style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
      Resetear contraseña
    </a>
    <p style="color:#9ca3af;font-size:13px;margin-top:28px;">
      Si no pediste esto, ignorá este email. Tu contraseña no va a cambiar.
    </p>
    <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;">
    <p style="color:#d1d5db;font-size:11px;margin:0;">
      O pegá este link en tu navegador:<br>
      <span style="color:#6366f1;word-break:break-all;">${resetUrl}</span>
    </p>
  </div>
</body>
</html>
  `.trim();
}
