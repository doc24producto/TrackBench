-- Borrar todo lo existente primero (orden inverso por dependencias)
DROP TABLE IF EXISTS "alert_settings" CASCADE;
DROP TABLE IF EXISTS "subscriptions" CASCADE;
DROP TABLE IF EXISTS "price_alerts" CASCADE;
DROP TABLE IF EXISTS "price_history" CASCADE;
DROP TABLE IF EXISTS "competitors" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

DROP TYPE IF EXISTS "AlertType" CASCADE;
DROP TYPE IF EXISTS "Marketplace" CASCADE;
DROP TYPE IF EXISTS "SubscriptionStatus" CASCADE;
DROP TYPE IF EXISTS "SubscriptionTier" CASCADE;

-- Enums
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'PRO');
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'canceled', 'past_due', 'trialing');
CREATE TYPE "Marketplace" AS ENUM ('amazon', 'mercadolibre', 'shopify');
CREATE TYPE "AlertType" AS ENUM ('price_change', 'price_lower', 'price_higher', 'price_stale');

-- Tabla: users
CREATE TABLE "users" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "email"             TEXT        NOT NULL,
  "password"          TEXT,
  "name"              TEXT        NOT NULL,
  "subscriptionTier"  "SubscriptionTier" NOT NULL DEFAULT 'FREE',
  "stripeCustomerId"  TEXT,
  "emailVerified"     BOOLEAN     NOT NULL DEFAULT false,
  "verificationToken" TEXT,
  "resetToken"        TEXT,
  "resetTokenExpiry"  TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- Tabla: products
CREATE TABLE "products" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"        UUID        NOT NULL,
  "name"          TEXT        NOT NULL,
  "url"           TEXT        NOT NULL,
  "marketplace"   "Marketplace" NOT NULL,
  "country"       TEXT        NOT NULL,
  "marketplaceId" TEXT,
  "sku"           TEXT,
  "imageUrl"      TEXT,
  "currentPrice"  DOUBLE PRECISION,
  "currency"      TEXT        NOT NULL DEFAULT 'USD',
  "isAvailable"   BOOLEAN     NOT NULL DEFAULT true,
  "lastScrapedAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- Tabla: competitors
CREATE TABLE "competitors" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "productId"     UUID        NOT NULL,
  "name"          TEXT        NOT NULL,
  "url"           TEXT        NOT NULL,
  "marketplace"   "Marketplace" NOT NULL,
  "currentPrice"  DOUBLE PRECISION,
  "currency"      TEXT        NOT NULL DEFAULT 'USD',
  "reviewCount"   INTEGER,
  "rating"        DOUBLE PRECISION,
  "imageUrl"      TEXT,
  "description"   TEXT,
  "isAvailable"   BOOLEAN     NOT NULL DEFAULT true,
  "lastScrapedAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- Tabla: price_history
CREATE TABLE "price_history" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "productId"    UUID,
  "competitorId" UUID,
  "price"        DOUBLE PRECISION NOT NULL,
  "currency"     TEXT        NOT NULL DEFAULT 'USD',
  "recordedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- Tabla: price_alerts
CREATE TABLE "price_alerts" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"       UUID        NOT NULL,
  "competitorId" UUID        NOT NULL,
  "alertType"    "AlertType" NOT NULL,
  "triggerValue" DOUBLE PRECISION NOT NULL,
  "oldPrice"     DOUBLE PRECISION,
  "newPrice"     DOUBLE PRECISION,
  "isRead"       BOOLEAN     NOT NULL DEFAULT false,
  "sentAt"       TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- Tabla: subscriptions
CREATE TABLE "subscriptions" (
  "id"                   UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"               UUID        NOT NULL,
  "stripeSubscriptionId" TEXT,
  "tier"                 "SubscriptionTier" NOT NULL DEFAULT 'FREE',
  "status"               "SubscriptionStatus" NOT NULL DEFAULT 'active',
  "currentPeriodStart"   TIMESTAMP(3),
  "currentPeriodEnd"     TIMESTAMP(3),
  "cancelAtPeriodEnd"    BOOLEAN     NOT NULL DEFAULT false,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- Tabla: alert_settings
CREATE TABLE "alert_settings" (
  "id"                   UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"               UUID        NOT NULL,
  "emailAlerts"          BOOLEAN     NOT NULL DEFAULT true,
  "dailyDigest"          BOOLEAN     NOT NULL DEFAULT false,
  "priceChangeThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  "digestTime"           TEXT        NOT NULL DEFAULT '08:00',
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alert_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "alert_settings_userId_key" ON "alert_settings"("userId");

-- Relaciones
ALTER TABLE "products"      ADD CONSTRAINT "products_userId_fkey"              FOREIGN KEY ("userId")       REFERENCES "users"("id")       ON DELETE CASCADE;
ALTER TABLE "competitors"   ADD CONSTRAINT "competitors_productId_fkey"        FOREIGN KEY ("productId")    REFERENCES "products"("id")    ON DELETE CASCADE;
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_productId_fkey"      FOREIGN KEY ("productId")    REFERENCES "products"("id")    ON DELETE CASCADE;
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_competitorId_fkey"   FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE;
ALTER TABLE "price_alerts"  ADD CONSTRAINT "price_alerts_userId_fkey"          FOREIGN KEY ("userId")       REFERENCES "users"("id")       ON DELETE CASCADE;
ALTER TABLE "price_alerts"  ADD CONSTRAINT "price_alerts_competitorId_fkey"    FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey"         FOREIGN KEY ("userId")       REFERENCES "users"("id")       ON DELETE CASCADE;
ALTER TABLE "alert_settings" ADD CONSTRAINT "alert_settings_userId_fkey"       FOREIGN KEY ("userId")       REFERENCES "users"("id")       ON DELETE CASCADE;
