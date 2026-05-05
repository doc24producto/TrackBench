import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthRequest, TIER_LIMITS } from '../types';
import { scrapeProduct } from '../services/scraperService';

const router = Router();
router.use(authenticate);

// POST /api/products/:id/competitors
router.post(
  '/products/:id/competitors',
  [body('url').isURL()],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw createError('Invalid URL', 400);

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { _count: { select: { competitors: true } } },
    });
    if (!product) throw createError('Product not found', 404);

    const tier = req.user!.subscriptionTier;
    const limits = TIER_LIMITS[tier];
    if (product._count.competitors >= limits.maxCompetitorsPerProduct) {
      throw createError(`Your ${tier} plan allows up to ${limits.maxCompetitorsPerProduct} competitors per product.`, 403);
    }

    const { url } = req.body;
    const existing = await prisma.competitor.findFirst({
      where: { productId: req.params.id, url },
    });
    if (existing) throw createError('Competitor already tracked', 409);

    const scraped = await scrapeProduct(url);
    if (!scraped.success || !scraped.data) throw createError(scraped.error || 'Failed to scrape competitor', 422);

    const marketplace = url.includes('amazon') ? 'amazon' : url.includes('mercadolibre') ? 'mercadolibre' : 'shopify';
    const competitor = await prisma.competitor.create({
      data: {
        productId: req.params.id,
        name: scraped.data.name,
        url,
        marketplace: marketplace as 'amazon' | 'mercadolibre' | 'shopify',
        currentPrice: scraped.data.price,
        currency: scraped.data.currency,
        reviewCount: scraped.data.reviewCount,
        rating: scraped.data.rating,
        imageUrl: scraped.data.imageUrl,
        description: scraped.data.description,
        lastScrapedAt: new Date(),
      },
    });

    if (scraped.data.price) {
      await prisma.priceHistory.create({
        data: { competitorId: competitor.id, price: scraped.data.price, currency: scraped.data.currency },
      });
    }

    res.status(201).json(competitor);
  })
);

// GET /api/products/:id/competitors
router.get(
  '/products/:id/competitors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!product) throw createError('Product not found', 404);

    const competitors = await prisma.competitor.findMany({
      where: { productId: req.params.id },
      orderBy: { currentPrice: 'asc' },
    });
    res.json(competitors);
  })
);

// DELETE /api/competitors/:id
router.delete(
  '/competitors/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const competitor = await prisma.competitor.findFirst({
      where: { id: req.params.id },
      include: { product: { select: { userId: true } } },
    });
    if (!competitor || competitor.product.userId !== req.user!.id) {
      throw createError('Competitor not found', 404);
    }
    await prisma.competitor.delete({ where: { id: req.params.id } });
    res.json({ message: 'Competitor removed' });
  })
);

// GET /api/competitors/:id/price-history
router.get(
  '/competitors/:id/price-history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const competitor = await prisma.competitor.findFirst({
      where: { id: req.params.id },
      include: { product: { select: { userId: true } } },
    });
    if (!competitor || competitor.product.userId !== req.user!.id) {
      throw createError('Competitor not found', 404);
    }

    const days = parseInt(req.query.days as string) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const history = await prisma.priceHistory.findMany({
      where: { competitorId: req.params.id, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'asc' },
    });
    res.json(history);
  })
);

export default router;
