import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

// GET /api/dashboard/summary
router.get(
  '/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const [productCount, products, today] = await Promise.all([
      prisma.product.count({ where: { userId } }),
      prisma.product.findMany({
        where: { userId },
        include: { competitors: { select: { currentPrice: true, currency: true } } },
      }),
      (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      })(),
    ]);

    const alertCount = await prisma.priceAlert.count({
      where: { userId, createdAt: { gte: today } },
    });

    const competitorCount = products.reduce((sum, p) => sum + p.competitors.length, 0);

    const allCompetitorPrices = products.flatMap((p) =>
      p.competitors.map((c) => c.currentPrice).filter(Boolean) as number[]
    );
    const marketAvg = allCompetitorPrices.length
      ? allCompetitorPrices.reduce((a, b) => a + b, 0) / allCompetitorPrices.length
      : null;

    const yourPrices = products.map((p) => p.currentPrice).filter(Boolean) as number[];
    const yourAvg = yourPrices.length
      ? yourPrices.reduce((a, b) => a + b, 0) / yourPrices.length
      : null;

    const positionVsMarket =
      yourAvg && marketAvg
        ? `${((yourAvg - marketAvg) / marketAvg * 100).toFixed(1)}%`
        : null;

    res.json({
      productCount,
      competitorCount,
      alertsToday: alertCount,
      yourAveragePrice: yourAvg,
      marketAveragePrice: marketAvg,
      positionVsMarket,
    });
  })
);

// GET /api/dashboard/price-comparison/:product_id
router.get(
  '/price-comparison/:productId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.productId, userId: req.user!.id },
      include: {
        competitors: {
          orderBy: { currentPrice: 'asc' },
        },
      },
    });
    if (!product) throw createError('Product not found', 404);

    const competitorPrices = product.competitors
      .map((c) => c.currentPrice)
      .filter(Boolean) as number[];
    const marketAvg = competitorPrices.length
      ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
      : null;

    const ranked = product.competitors.map((c, index) => ({
      ...c,
      rank: index + 1,
      priceDiff: product.currentPrice && c.currentPrice ? c.currentPrice - product.currentPrice : null,
    }));

    res.json({
      product: { id: product.id, name: product.name, currentPrice: product.currentPrice, currency: product.currency },
      competitors: ranked,
      marketAverage: marketAvg,
      lowestPrice: competitorPrices[0] || null,
      highestPrice: competitorPrices[competitorPrices.length - 1] || null,
    });
  })
);

// GET /api/analytics/price-trends
router.get(
  '/price-trends',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const productId = req.query.productId as string;
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    if (productId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, userId: req.user!.id },
      });
      if (!product) throw createError('Product not found', 404);
    }

    const userId = req.user!.id;
    const products = await prisma.product.findMany({
      where: { userId, ...(productId && { id: productId }) },
      include: {
        priceHistory: {
          where: { recordedAt: { gte: since } },
          orderBy: { recordedAt: 'asc' },
        },
        competitors: {
          include: {
            priceHistory: {
              where: { recordedAt: { gte: since } },
              orderBy: { recordedAt: 'asc' },
            },
          },
        },
      },
    });

    res.json(products);
  })
);

export default router;
