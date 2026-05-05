import cron from 'node-cron';
import prisma from '../lib/prisma';
import { enqueue } from '../lib/jobRunner';
import { scrapeProduct } from '../services/scraperService';
import { checkAndCreateAlerts } from '../services/priceAlertService';
import { sendDailyDigest } from '../services/notificationService';
import logger from '../lib/logger';

export async function scrapeAndUpdateProduct(productId: string, url: string): Promise<void> {
  const result = await scrapeProduct(url);
  if (!result.success || !result.data) {
    logger.warn(`Scrape failed for product ${productId}: ${result.error}`);
    return;
  }
  const { price, currency, imageUrl, name } = result.data;
  await prisma.product.update({
    where: { id: productId },
    data: { currentPrice: price, currency, imageUrl, name, lastScrapedAt: new Date() },
  });
  if (price) {
    await prisma.priceHistory.create({ data: { productId, price, currency } });
  }
  logger.info(`Product ${productId} updated: $${price}`);
}

export async function scrapeAndUpdateCompetitor(competitorId: string, url: string): Promise<void> {
  const result = await scrapeProduct(url);
  if (!result.success || !result.data) {
    logger.warn(`Scrape failed for competitor ${competitorId}: ${result.error}`);
    return;
  }
  const { price, currency, imageUrl, rating, reviewCount, name } = result.data;
  const old = await prisma.competitor.findUnique({ where: { id: competitorId } });
  const oldPrice = old?.currentPrice ?? null;

  await prisma.competitor.update({
    where: { id: competitorId },
    data: { currentPrice: price, currency, imageUrl, rating, reviewCount, name, lastScrapedAt: new Date() },
  });
  if (price) {
    await prisma.priceHistory.create({ data: { competitorId, price, currency } });
    await checkAndCreateAlerts(competitorId, oldPrice, price);
  }
  logger.info(`Competitor ${competitorId} updated: $${price}`);
}

async function runDailyScrape(): Promise<void> {
  logger.info('Starting daily scrape cycle');
  const [products, competitors] = await Promise.all([
    prisma.product.findMany({ select: { id: true, url: true } }),
    prisma.competitor.findMany({ select: { id: true, url: true } }),
  ]);

  for (const p of products) {
    enqueue(`scrape-product-${p.id}`, () => scrapeAndUpdateProduct(p.id, p.url));
  }
  for (const c of competitors) {
    enqueue(`scrape-competitor-${c.id}`, () => scrapeAndUpdateCompetitor(c.id, c.url));
  }
  logger.info(`Enqueued ${products.length} products + ${competitors.length} competitors`);
}

async function runDailyDigests(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { alertSettings: { dailyDigest: true }, subscriptionTier: { not: 'FREE' } },
    select: { id: true },
  });
  for (const user of users) {
    enqueue(`digest-${user.id}`, () => sendDailyDigest(user.id));
  }
}

export function initJobs(): void {
  const intervalHours = parseInt(process.env.SCRAPE_INTERVAL_HOURS || '12');
  cron.schedule(`0 */${intervalHours} * * *`, () => {
    runDailyScrape().catch((err) => logger.error('Daily scrape failed', err));
  });

  cron.schedule('0 8 * * *', () => {
    runDailyDigests().catch((err) => logger.error('Daily digests failed', err));
  });

  logger.info(`Cron jobs initialized (scrape every ${intervalHours}h)`);
}
