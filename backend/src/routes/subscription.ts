import { Router, Response } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthRequest, STRIPE_PRICE_IDS, TIER_LIMITS } from '../types';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

router.use(authenticate);

// GET /api/subscription
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });
    const usage = await prisma.product.count({ where: { userId: req.user!.id } });
    const limits = TIER_LIMITS[req.user!.subscriptionTier];
    res.json({ subscription, usage: { products: usage }, limits });
  })
);

// GET /api/subscription/usage
router.get(
  '/usage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const [productCount, products] = await Promise.all([
      prisma.product.count({ where: { userId } }),
      prisma.product.findMany({
        where: { userId },
        include: { _count: { select: { competitors: true } } },
      }),
    ]);
    const maxCompetitors = Math.max(...products.map((p) => p._count.competitors), 0);
    res.json({ products: productCount, maxCompetitorsInAnyProduct: maxCompetitors });
  })
);

// POST /api/subscription/upgrade
router.post(
  '/upgrade',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { tier } = req.body;
    if (!['STARTER', 'GROWTH', 'PRO'].includes(tier)) throw createError('Invalid tier', 400);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw createError('User not found', 404);

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const priceId = STRIPE_PRICE_IDS[tier];
    if (!priceId) throw createError('Stripe price not configured for this tier', 500);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/settings`,
      metadata: { userId: user.id, tier },
    });

    res.json({ url: session.url });
  })
);

// POST /api/subscription/cancel
router.post(
  '/cancel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user!.id },
    });
    if (!subscription?.stripeSubscriptionId) throw createError('No active subscription', 400);

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await prisma.subscription.update({
      where: { userId: req.user!.id },
      data: { cancelAtPeriodEnd: true },
    });
    res.json({ message: 'Subscription will cancel at end of billing period' });
  })
);

export default router;
