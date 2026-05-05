import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';
import { scrapeProduct, detectMarketplace, detectCountry } from '@/lib/scraper';

const TIER_LIMITS: Record<string, number> = {
  FREE: 3, STARTER: 10, GROWTH: 25, PRO: 100,
};

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: products } = await supabase.from('products')
    .select('*, competitors(id, name, currentPrice, currency)')
    .eq('userId', user.id)
    .order('createdAt', { ascending: false });

  const withCount = (products || []).map((p) => ({
    ...p,
    _count: { competitors: p.competitors?.length ?? 0 },
  }));

  return NextResponse.json(withCount);
}

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { url, name: manualName, price: manualPrice, currency: manualCurrency } = await req.json();
  if (!url) return NextResponse.json({ error: 'URL requerida' }, { status: 400 });

  const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('userId', user.id);
  const limit = TIER_LIMITS[user.subscriptionTier] ?? 3;
  if ((count ?? 0) >= limit) {
    return NextResponse.json({ error: `Tu plan permite hasta ${limit} productos` }, { status: 403 });
  }

  const marketplace = detectMarketplace(url);
  const country = detectCountry(url);

  if (manualName) {
    const { data: product, error } = await supabase.from('products').insert({
      userId: user.id, name: manualName, url, marketplace, country,
      currentPrice: manualPrice ? parseFloat(manualPrice) : null,
      currency: manualCurrency || 'ARS',
      lastScrapedAt: new Date().toISOString(),
    }).select().single();

    if (error) return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
    if (manualPrice) {
      await supabase.from('price_history').insert({
        productId: product.id, price: parseFloat(manualPrice), currency: manualCurrency || 'ARS',
      });
    }
    return NextResponse.json(product, { status: 201 });
  }

  const scraped = await scrapeProduct(url);
  if (!scraped.success || !scraped.data) {
    return NextResponse.json({ scraped: false, url, error: scraped.error }, { status: 200 });
  }

  const { data: product, error } = await supabase.from('products').insert({
    userId: user.id,
    name: scraped.data.name,
    url, marketplace, country,
    imageUrl: scraped.data.imageUrl,
    currentPrice: scraped.data.price,
    currency: scraped.data.currency,
    sku: scraped.data.sku,
    lastScrapedAt: new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });

  if (scraped.data.price) {
    await supabase.from('price_history').insert({
      productId: product.id, price: scraped.data.price, currency: scraped.data.currency,
    });
  }

  return NextResponse.json(product, { status: 201 });
}
