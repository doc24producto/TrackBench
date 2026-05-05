import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthRequest, TIER_LIMITS } from '../types';
import { scrapeProduct } from '../services/scraperService';
import { enqueue } from '../lib/jobRunner';
import { scrapeAndUpdateProduct, scrapeAndUpdateCompetitor } from '../jobs/scrapeJob';

const router = Router();
router.use(authenticate);

// GET /api/products
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const products = await prisma.product.findMany({
      where: { userId: req.user!.id },
      include: {
        competitors: { select: { id: true, name: true, currentPrice: true, currency: true } },
        _count: { select: { competitors: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  })
);

// GET /api/products/:id
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { competitors: { orderBy: { currentPrice: 'asc' } } },
    });
    if (!product) throw createError('Product not found', 404);
    res.json(product);
  })
);

// POST /api/products
router.post(
  '/',
  [body('url').isURL()],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw createError('URL inválida', 400);

    const { url, name: manualName, price: manualPrice, currency: manualCurrency } = req.body;
    const tier = req.user!.subscriptionTier;
    const limits = TIER_LIMITS[tier];

    const count = await prisma.product.count({ where: { userId: req.user!.id } });
    if (count >= limits.maxProducts) {
      throw createError(`Tu plan ${tier} permite hasta ${limits.maxProducts} productos. Actualizá tu plan para agregar más.`, 403);
    }

    const marketplace = detectMarketplace(url);

    // Si el usuario mandó datos manuales, los usamos directamente sin scraping
    if (manualName) {
      const product = await prisma.product.create({
        data: {
          userId: req.user!.id,
          name: manualName,
          url,
          marketplace,
          country: detectCountry(url),
          currentPrice: manualPrice ? parseFloat(manualPrice) : null,
          currency: manualCurrency || 'ARS',
          lastScrapedAt: new Date(),
        },
      });
      if (manualPrice) {
        await prisma.priceHistory.create({
          data: { productId: product.id, price: parseFloat(manualPrice), currency: manualCurrency || 'ARS' },
        });
      }
      return res.status(201).json(product);
    }

    // Si no hay datos manuales, intentamos scraping
    const scraped = await scrapeProduct(url);
    if (!scraped.success || !scraped.data) {
      // Devolvemos 200 con scraped=false para que el frontend muestre formulario manual
      return res.status(200).json({ scraped: false, url, error: scraped.error || 'No se pudo leer el producto automáticamente' });
    }

    const product = await prisma.product.create({
      data: {
        userId: req.user!.id,
        name: scraped.data.name,
        url,
        marketplace,
        country: detectCountry(url),
        imageUrl: scraped.data.imageUrl,
        currentPrice: scraped.data.price,
        currency: scraped.data.currency,
        sku: scraped.data.sku,
        lastScrapedAt: new Date(),
      },
    });

    if (scraped.data.price) {
      await prisma.priceHistory.create({
        data: { productId: product.id, price: scraped.data.price, currency: scraped.data.currency },
      });
    }

    res.status(201).json(product);
  })
);

// PUT /api/products/:id
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw createError('Product not found', 404);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { sku: req.body.sku, name: req.body.name },
    });
    res.json(product);
  })
);

// DELETE /api/products/:id
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) throw createError('Product not found', 404);
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ message: 'Producto eliminado' });
  })
);

// GET /api/products/:id/price-history
router.get(
  '/:id/price-history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const product = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!product) throw createError('Product not found', 404);
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const history = await prisma.priceHistory.findMany({
      where: { productId: req.params.id, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'asc' },
    });
    res.json(history);
  })
);

// POST /api/products/:id/refresh — encola re-scraping en background
router.post(
  '/:id/refresh',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { competitors: { select: { id: true, url: true } } },
    });
    if (!product) throw createError('Product not found', 404);

    enqueue(`refresh-product-${product.id}`, () => scrapeAndUpdateProduct(product.id, product.url));
    for (const c of product.competitors) {
      enqueue(`refresh-competitor-${c.id}`, () => scrapeAndUpdateCompetitor(c.id, c.url));
    }

    res.json({ message: 'Actualización iniciada en background' });
  })
);

function detectMarketplace(url: string) {
  if (url.includes('amazon')) return 'amazon' as const;
  if (url.includes('mercadolibre') || url.includes('articulo.mercado')) return 'mercadolibre' as const;
  return 'shopify' as const;
}

function detectCountry(url: string): string {
  if (url.includes('.com.br')) return 'com.br';
  if (url.includes('.com.mx')) return 'com.mx';
  if (url.includes('.com.ar')) return 'com.ar';
  return 'com';
}

export default router;
