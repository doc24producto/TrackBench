import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

// GET /api/alerts
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const filter = req.query.filter as string;
    let dateFilter: Date | undefined;

    if (filter === 'today') {
      dateFilter = new Date();
      dateFilter.setHours(0, 0, 0, 0);
    } else if (filter === 'week') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 7);
    }

    const alerts = await prisma.priceAlert.findMany({
      where: {
        userId: req.user!.id,
        ...(dateFilter && { createdAt: { gte: dateFilter } }),
      },
      include: {
        competitor: { select: { name: true, url: true, currentPrice: true, product: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(alerts);
  })
);

// GET /api/alerts/settings
router.get(
  '/settings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const settings = await prisma.alertSettings.findUnique({
      where: { userId: req.user!.id },
    });
    res.json(settings);
  })
);

// PUT /api/alerts/settings
router.put(
  '/settings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { emailAlerts, dailyDigest, priceChangeThreshold, digestTime } = req.body;
    const settings = await prisma.alertSettings.upsert({
      where: { userId: req.user!.id },
      update: { emailAlerts, dailyDigest, priceChangeThreshold, digestTime },
      create: { userId: req.user!.id, emailAlerts, dailyDigest, priceChangeThreshold, digestTime },
    });
    res.json(settings);
  })
);

// DELETE /api/alerts/:id (dismiss)
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const alert = await prisma.priceAlert.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!alert) throw createError('Alert not found', 404);
    await prisma.priceAlert.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ message: 'Alert dismissed' });
  })
);

// GET /api/dashboard/alerts-today
router.get(
  '/today',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await prisma.priceAlert.count({
      where: { userId: req.user!.id, createdAt: { gte: today } },
    });
    res.json({ count });
  })
);

export default router;
