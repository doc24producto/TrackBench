import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';
import { scrapeProduct, detectCountry, getBrandName, validateUrl } from '@/lib/scraper';

const TIER_LIMITS: Record<string, number> = {
  FREE: 3, STARTER: 10, GROWTH: 25, PRO: 100,
};

// ── GET /api/products ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = getUser(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: products, error } = await supabase
      .from('products')
      .select('*, competitors(id, name, currentPrice, currency, lastScrapedAt)')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('[GET /api/products] Supabase error:', error);
      return NextResponse.json(
        { error: 'Error al obtener productos', detail: error.message, code: error.code },
        { status: 500 }
      );
    }

    const withCount = (products ?? []).map((p) => ({
      ...p,
      _count: { competitors: p.competitors?.length ?? 0 },
    }));

    return NextResponse.json(withCount);
  } catch (e) {
    console.error('[GET /api/products] Unhandled:', e);
    return NextResponse.json({ error: 'Error interno', detail: String(e) }, { status: 500 });
  }
}

// ── POST /api/products ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let url = '';
  try {
    const user = getUser(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    url = (body.url ?? '').trim();
    const manualName: string | undefined = body.name;
    const manualPrice: string | undefined = body.price;
    const manualCurrency: string = body.currency ?? 'ARS';

    if (!url) return NextResponse.json({ error: 'URL requerida' }, { status: 400 });

    const security = validateUrl(url);
    if (!security.valid) return NextResponse.json({ error: security.error }, { status: 400 });

    // ── Tier limit check ──────────────────────────────────────────────────────
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('userId', user.id);

    if (countError) {
      console.error('[POST /api/products] Count error:', countError);
      return NextResponse.json(
        { error: 'Error al verificar límite', detail: countError.message },
        { status: 500 }
      );
    }

    const limit = TIER_LIMITS[user.subscriptionTier] ?? 3;
    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: `Alcanzaste el límite de ${limit} productos en tu plan. Subí de plan para continuar.` },
        { status: 403 }
      );
    }

    const country = detectCountry(url);
    const brandName = getBrandName(url);

    // ── Manual entry (user already filled name) ───────────────────────────────
    if (manualName?.trim()) {
      const { data: product, error } = await supabase
        .from('products')
        .insert({
          userId: user.id,
          name: manualName.trim(),
          url,
          marketplace: brandName,
          country,
          currentPrice: manualPrice ? parseFloat(manualPrice) : null,
          currency: manualCurrency,
          isAvailable: true,
          lastScrapedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[POST /api/products] Insert (manual) error:', error);
        return NextResponse.json({ error: 'Error al guardar', detail: error.message }, { status: 500 });
      }

      if (manualPrice) {
        await supabase.from('price_history').insert({
          productId: product.id,
          price: parseFloat(manualPrice),
          currency: manualCurrency,
        });
      }

      return NextResponse.json(product, { status: 201 });
    }

    // ── Auto-scrape (race with hard timeout) ──────────────────────────────────
    // Vercel free = 10 s max; race at 7 s to leave buffer for DB ops.
    const scraped = await Promise.race([
      scrapeProduct(url),
      new Promise<{ success: false; error: string }>((resolve) =>
        setTimeout(
          () => resolve({ success: false, error: 'El sitio tardó demasiado. Ingresá los datos manualmente.' }),
          7000
        )
      ),
    ]);

    // Scrape failed → ask user to fill manually (not a server error)
    if (!scraped.success || !('data' in scraped) || !scraped.data) {
      return NextResponse.json(
        { scraped: false, url, error: (scraped as { error?: string }).error ?? 'No se pudo leer el producto.' },
        { status: 200 }
      );
    }

    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert({
        userId: user.id,
        name: scraped.data.name,
        url,
        marketplace: brandName,
        country,
        imageUrl: scraped.data.imageUrl,
        currentPrice: scraped.data.price,
        currency: scraped.data.currency,
        sku: scraped.data.sku,
        isAvailable: scraped.data.isAvailable,
        lastScrapedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[POST /api/products] Insert error:', insertError.code, insertError.message);
      return NextResponse.json(
        { error: 'Error al guardar el producto', detail: insertError.message, code: insertError.code },
        { status: 500 }
      );
    }

    if (scraped.data.price) {
      await supabase.from('price_history').insert({
        productId: product.id,
        price: scraped.data.price,
        currency: scraped.data.currency,
      });
    }

    return NextResponse.json({ ...product, _scrapeSource: (scraped as { source?: string }).source }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/products] Unhandled exception:', e);
    // Never return 500 for scraper issues — fall back to manual entry
    return NextResponse.json(
      { scraped: false, url, error: 'Error al procesar la URL. Ingresá los datos manualmente.' },
      { status: 200 }
    );
  }
}
