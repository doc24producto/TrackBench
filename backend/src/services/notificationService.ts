import sgMail from '@sendgrid/mail';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const FROM = process.env.SENDGRID_FROM_EMAIL || 'noreply@competitortrack.com';
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

export async function sendPriceAlertEmail(alertId: string): Promise<void> {
  const alert = await prisma.priceAlert.findUnique({
    where: { id: alertId },
    include: {
      user: { select: { email: true, name: true } },
      competitor: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  if (!alert) { logger.warn(`Alert ${alertId} not found`); return; }

  const direction = alert.alertType === 'price_lower' ? 'lowered' : 'raised';
  const subject = `Price Alert: ${alert.competitor.name} ${direction} their price`;
  const dashboardUrl = `${FRONTEND}/dashboard/products/${alert.competitor.product.id}`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e40af">CompetitorTrack Price Alert</h2>
      <p>Hi ${alert.user.name},</p>
      <p>Your competitor <strong>${alert.competitor.name}</strong> has ${direction} their price for <strong>${alert.competitor.product.name}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb">Previous Price</td>
          <td style="padding:8px;border:1px solid #e5e7eb">${alert.oldPrice ? `$${alert.oldPrice.toFixed(2)}` : 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb">New Price</td>
          <td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;color:${alert.alertType === 'price_lower' ? '#dc2626' : '#16a34a'}">${alert.newPrice ? `$${alert.newPrice.toFixed(2)}` : 'N/A'}</td>
        </tr>
      </table>
      <a href="${dashboardUrl}" style="display:inline-block;background:#1e40af;color:white;padding:12px 24px;text-decoration:none;border-radius:6px">View Dashboard</a>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">You're receiving this because you track ${alert.competitor.product.name} on CompetitorTrack.</p>
    </div>
  `;

  try {
    await sgMail.send({ to: alert.user.email, from: FROM, subject, html });
    await prisma.priceAlert.update({ where: { id: alertId }, data: { sentAt: new Date() } });
    logger.info(`Alert email sent to ${alert.user.email} for alert ${alertId}`);
  } catch (err) {
    logger.error('Failed to send alert email', err);
    throw err;
  }
}

export async function sendDailyDigest(userId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [user, alerts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    prisma.priceAlert.findMany({
      where: { userId, createdAt: { gte: today } },
      include: {
        competitor: { include: { product: { select: { name: true } } } },
      },
    }),
  ]);

  if (!user || !alerts.length) return;

  const rows = alerts.map((a) =>
    `<tr><td style="padding:8px;border:1px solid #e5e7eb">${a.competitor.product.name}</td><td style="padding:8px;border:1px solid #e5e7eb">${a.competitor.name}</td><td style="padding:8px;border:1px solid #e5e7eb">${a.alertType}</td><td style="padding:8px;border:1px solid #e5e7eb">$${a.newPrice?.toFixed(2)}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e40af">Your Daily CompetitorTrack Summary</h2>
      <p>Hi ${user.name}, here's what happened today:</p>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr style="background:#f9fafb"><th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Your Product</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Competitor</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left">Change</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left">New Price</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <a href="${FRONTEND}/dashboard/alerts" style="display:inline-block;background:#1e40af;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:16px">View All Alerts</a>
    </div>
  `;

  await sgMail.send({
    to: user.email,
    from: FROM,
    subject: `CompetitorTrack Daily Digest — ${alerts.length} price changes today`,
    html,
  });
}
