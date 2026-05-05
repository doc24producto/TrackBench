export type SubscriptionTier = 'FREE' | 'STARTER' | 'GROWTH' | 'PRO';
export type Marketplace = 'amazon' | 'mercadolibre' | 'shopify';
export type AlertType = 'price_change' | 'price_lower' | 'price_higher' | 'price_stale';

export interface User {
  id: string;
  email: string;
  name: string;
  subscriptionTier: SubscriptionTier;
  createdAt: string;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  url: string;
  marketplace: Marketplace;
  country: string;
  sku: string | null;
  imageUrl: string | null;
  currentPrice: number | null;
  currency: string;
  isAvailable: boolean;
  lastScrapedAt: string | null;
  createdAt: string;
  updatedAt: string;
  competitors?: Competitor[];
  _count?: { competitors: number };
}

export interface Competitor {
  id: string;
  productId: string;
  name: string;
  url: string;
  marketplace: Marketplace;
  currentPrice: number | null;
  currency: string;
  reviewCount: number | null;
  rating: number | null;
  imageUrl: string | null;
  description: string | null;
  isAvailable: boolean;
  lastScrapedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rank?: number;
  priceDiff?: number | null;
}

export interface PriceHistory {
  id: string;
  productId: string | null;
  competitorId: string | null;
  price: number;
  currency: string;
  recordedAt: string;
}

export interface PriceAlert {
  id: string;
  userId: string;
  competitorId: string;
  alertType: AlertType;
  triggerValue: number;
  oldPrice: number | null;
  newPrice: number | null;
  isRead: boolean;
  sentAt: string | null;
  createdAt: string;
  competitor?: Competitor & { product?: { id: string; name: string } };
}

export interface AlertSettings {
  id: string;
  userId: string;
  emailAlerts: boolean;
  dailyDigest: boolean;
  priceChangeThreshold: number;
  digestTime: string;
}

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string | null;
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface DashboardSummary {
  productCount: number;
  competitorCount: number;
  alertsToday: number;
  yourAveragePrice: number | null;
  marketAveragePrice: number | null;
  positionVsMarket: string | null;
}

export interface TierLimit {
  maxProducts: number;
  maxCompetitorsPerProduct: number;
  alertsEnabled: boolean;
  apiAccess: boolean;
}
