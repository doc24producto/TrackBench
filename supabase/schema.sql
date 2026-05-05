-- ============================================================
-- CompetitorTrack – Schema para Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Extensión para UUIDs
create extension if not exists "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password      text not null,
  name          text not null,
  "subscriptionTier" text not null default 'FREE',
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);

-- ─── PRODUCTS ────────────────────────────────────────────────
create table if not exists products (
  id             uuid primary key default gen_random_uuid(),
  "userId"       uuid not null references users(id) on delete cascade,
  name           text not null,
  url            text not null,
  marketplace    text,
  country        text,
  "imageUrl"     text,
  "currentPrice" numeric,
  currency       text not null default 'ARS',
  sku            text,
  "lastScrapedAt" timestamptz,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);

-- ─── COMPETITORS ─────────────────────────────────────────────
create table if not exists competitors (
  id             uuid primary key default gen_random_uuid(),
  "productId"    uuid not null references products(id) on delete cascade,
  name           text,
  url            text not null,
  "currentPrice" numeric,
  currency       text default 'ARS',
  "lastScrapedAt" timestamptz,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);

-- ─── PRICE HISTORY ───────────────────────────────────────────
create table if not exists price_history (
  id           uuid primary key default gen_random_uuid(),
  "productId"  uuid not null references products(id) on delete cascade,
  price        numeric not null,
  currency     text not null default 'ARS',
  "createdAt" timestamptz not null default now()
);

-- ─── PRICE ALERTS ────────────────────────────────────────────
create table if not exists price_alerts (
  id             uuid primary key default gen_random_uuid(),
  "userId"       uuid not null references users(id) on delete cascade,
  "productId"    uuid references products(id) on delete cascade,
  "competitorId" uuid references competitors(id) on delete cascade,
  type           text not null default 'PRICE_DROP',
  message        text,
  "triggeredAt"  timestamptz,
  "createdAt"   timestamptz not null default now()
);

-- ─── ALERT SETTINGS ──────────────────────────────────────────
create table if not exists alert_settings (
  id                uuid primary key default gen_random_uuid(),
  "userId"          uuid unique not null references users(id) on delete cascade,
  "emailEnabled"    boolean not null default true,
  "priceDropPct"    numeric not null default 5,
  "priceRisePct"    numeric not null default 5,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);

-- ─── RLS desactivado (usamos service_role key) ───────────────
alter table users          disable row level security;
alter table products       disable row level security;
alter table competitors    disable row level security;
alter table price_history  disable row level security;
alter table price_alerts   disable row level security;
alter table alert_settings disable row level security;
