import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';
import { scrapeProduct, detectMarketplace, detectCountry, getBrandName, validateUrl } from '@/lib/scraper';

const TIER_LIMITS: Record<string, number> = {
  FREE: 3, STARTER: 10, GROWTH: 25, PRO: 100,
};

export async function GET(req: NextRequest) {
  try {
    const user = getUser(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: products, error } = await supabase.from('products')
      .select('*, competitors(id, name, currentPrice, currency)')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('[GET /api/products] Supabase error:', error);
      return NextResponse.json({ error: 'Error al obtener productos', detail: error.message, code: error.code }, { status: 500 });
    }

    const withCount = (products || []).map((p) => ({
      ...p,
      _count: { competitors: p.competitors?.length ?? 0 },
    }));

    return NextResponse.json(withCount);
  } catch (e) {
    console.error('[GET /api/products] Unhandled exception:', e);
    return NextResponse.json({ error: 'Error interno', detail: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { url, name: manualName, price: manualPrice, currency: manualCurrency } = await req.json();
  if (!url) return NextResponse.json({ error: 'URL requerida' }, { status: 400 });
  const security = validateUrl(url);
  if (!security.valid) return NextResponse.json({ error: security.error }, { status: 400 });

  const { count, error: countError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('userId', user.id);

  if (countError) {
    console.error('[POST /api/products] Count error:', countError);
    return NextResponse.json({ error: 'Error al verificar límite', detail: countError.message }, { status: 500 });
  }

  const limit = TIER_LIMITS[user.subscriptionTier] ?? 3;
  if ((count ?? 0) >= limit) {
    return NextResponse.json({ error: `Alcanzaste el límite de ${limit} productos en tu plan actual` }, { status: 403 });
  }

  const marketplace = detectMarketplace(url);
  const country = detectCountry(url);
  const brandName = getBrandName(url);

  if (manualName) {
    const { data: product, error } = await supabase.from('products').insert({
      userId: user.id, name: manualName, url, marketplace: brandName, country,
      currentPrice: manualPrice ? parseFloat(manualPrice) : null,
      currency: manualCurrency || 'ARS',
      isAvailable: true,
      lastScrapedAt: new Date().toISOString(),
    }).select().single();

    if (error) {
      console.error('[POST /api/products] Insert (manual) error:', error);
      return NextResponse.json({ error: 'Error al guardar', detail: error.message }, { status: 500 });
    }
    if (manualPrice) {
      await supabase.from('price_history').insert({
        productId: product.id, price: parseFloat(manualPrice), currency: manualCurrency || 'ARS',
      });
    }
    return NextResponse.json(product, { status: 201 });
  }

  // Race entre scraper y timeout de 8s (Vercel free = 10s max)
  const scraped = await Promise.race([
    scrapeProduct(url),
    new Promise<{ success: false; error: string }>((resolve) =>
      setTimeout(() => resolve({ success: false, error: 'El sitio tardó demasiado en responder. Ingresá los datos manualmente.' }), 8000)
    ),
  ]);
  if (!scraped.success || !('data' in scraped) || !scraped.data) {
    return NextResponse.json({ scraped: false, url, error: (scraped as { error?: string }).error }, { status: 200 });
  }

  const { data: product, error } = await supabase.from('products').insert({
    userId: user.id,
    name: scraped.data.name,
    url, marketplace: brandName, country,
    imageUrl: scraped.data.imageUrl,
    currentPrice: scraped.data.price,
    currency: scraped.data.currency,
    sku: scraped.data.sku,
    isAvailable: true,
    lastScrapedAt: new Date().toISOString(),
  }).select().single();

  if (error) {
    console.error('[POST /api/products] Insert error:', error);
    return NextResponse.json({ error: 'Error al guardar', detail: error.message }, { status: 500 });
  }

  if (scraped.data.price) {
    await supabase.from('price_history').insert({
      productId: product.id, price: scraped.data.price, currency: scraped.data.currency,
    });
  }

  return NextResponse.json(product, { status: 201 });
  } catch (e) {
    console.error('[POST /api/products] Unhandled exception:', e);
    // Never let scraper exceptions become 500 — fall back to manual entry
    return NextResponse.json({ scraped: false, url: '', error: 'Error interno al procesar la URL. Ingresá los datos manualmente.' }, { status: 200 });
  }
}
