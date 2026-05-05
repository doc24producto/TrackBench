import prisma from '../lib/prisma';
import { enqueue } from '../lib/jobRunner';
import { sendPriceAlertEmail } from './notificationService';
import logger from '../lib/logger';

export async function checkAndCreateAlerts(
  competitorId: string,
  oldPrice: number | null,
  newPrice: number | null
): Promise<void> {
  if (!oldPrice || !newPrice) return;

  const competitor = await prisma.competitor.findUnique({
    where: { id: competitorId },
    include: {
      product: {
        include: {
          user: { include: { alertSettings: true } },
        },
      },
    },
  });

  if (!competitor) return;

  const { user } = competitor.product;
  const threshold = user.alertSettings?.priceChangeThreshold ?? 5;
  const alertsEnabled = user.alertSettings?.emailAlerts ?? true;

  if (!alertsEnabled || user.subscriptionTier === 'FREE') return;

  const diff = Math.abs(newPrice - oldPrice);
  if (diff < threshold) return;

  const alertType = newPrice < oldPrice ? 'price_lower' : 'price_higher';

  const alert = await prisma.priceAlert.create({
    data: { userId: user.id, competitorId, alertType, triggerValue: threshold, oldPrice, newPrice },
  });

  enqueue(`send-alert-${alert.id}`, () => sendPriceAlertEmail(alert.id));

  logger.info(`Alert created: ${alertType} for competitor ${competitorId} (${oldPrice} → ${newPrice})`);
}
