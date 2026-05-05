import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscriptionTier: string;
  };
}

export interface ScrapedProduct {
  name: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  sku: string | null;
  description: string | null;
  isAvailable: boolean;
}

export interface ScrapeResult {
  success: boolean;
  data?: ScrapedProduct;
  error?: string;
}

export type TierLimits = {
  maxProducts: number;
  maxCompetitorsPerProduct: number;
  alertsEnabled: boolean;
  apiAccess: boolean;
};

export const TIER_LIMITS: Record<string, TierLimits> = {
  FREE: {
    maxProducts: 2,
    maxCompetitorsPerProduct: 5,
    alertsEnabled: false,
    apiAccess: false,
  },
  STARTER: {
    maxProducts: 5,
    maxCompetitorsPerProduct: 20,
    alertsEnabled: true,
    apiAccess: false,
  },
  GROWTH: {
    maxProducts: Infinity,
    maxCompetitorsPerProduct: 50,
    alertsEnabled: true,
    apiAccess: false,
  },
  PRO: {
    maxProducts: Infinity,
    maxCompetitorsPerProduct: Infinity,
    alertsEnabled: true,
    apiAccess: true,
  },
};

export const STRIPE_PRICE_IDS: Record<string, string> = {
  STARTER: process.env.STRIPE_STARTER_PRICE_ID || '',
  GROWTH: process.env.STRIPE_GROWTH_PRICE_ID || '',
  PRO: process.env.STRIPE_PRO_PRICE_ID || '',
};
