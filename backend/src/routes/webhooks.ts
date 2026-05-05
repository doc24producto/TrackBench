import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

const tierMap: Record<string, 'FREE' | 'STARTER' | 'GROWTH' | 'PRO'> = {
  [process.env.STRIPE_STARTER_PRICE_ID || '']: 'STARTER',
  [process.env.STRIPE_GROWTH_PRICE_ID || '']: 'GROWTH',
  [process.env.STRIPE_PRO_PRICE_ID || '']: 'PRO',
};

// POST /api/webhooks/stripe
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) { res.status(400).send('No signature'); return; }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Stripe webhook signature verification failed', message);
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, tier } = session.metadata || {};
        if (!userId || !tier) break;

        const stripeSubId = session.subscription as string;
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);

        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { subscriptionTier: tier as 'STARTER' | 'GROWTH' | 'PRO' },
          }),
          prisma.subscription.upsert({
            where: { userId },
            update: {
              stripeSubscriptionId: stripeSubId,
              tier: tier as 'STARTER' | 'GROWTH' | 'PRO',
              status: 'active',
              currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            },
            create: {
              userId,
              stripeSubscriptionId: stripeSubId,
              tier: tier as 'STARTER' | 'GROWTH' | 'PRO',
              status: 'active',
              currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            },
          }),
        ]);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;
        const tier = tierMap[priceId] || 'FREE';

        const dbSub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (dbSub) {
          await prisma.$transaction([
            prisma.subscription.update({
              where: { id: dbSub.id },
              data: {
                tier,
                status: sub.status as 'active' | 'canceled' | 'past_due',
                currentPeriodStart: new Date(sub.current_period_start * 1000),
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
                cancelAtPeriodEnd: sub.cancel_at_period_end,
              },
            }),
            prisma.user.update({
              where: { id: dbSub.userId },
              data: { subscriptionTier: tier },
            }),
          ]);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const dbSub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (dbSub) {
          await prisma.$transaction([
            prisma.subscription.update({
              where: { id: dbSub.id },
              data: { status: 'canceled', tier: 'FREE' },
            }),
            prisma.user.update({
              where: { id: dbSub.userId },
              data: { subscriptionTier: 'FREE' },
            }),
          ]);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: invoice.subscription as string },
        });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'past_due' },
          });
        }
        break;
      }
    }
  } catch (err) {
    logger.error('Webhook processing error', err);
  }

  res.json({ received: true });
});

export default router;
