import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';
import { scrapeProduct, getBrandName, validateUrl } from '@/lib/scraper';

const TIER_COMPETITOR_LIMITS: Record<string, number> = {
  FREE: 5, STARTER: 20, GROWTH: 50, PRO: 200,
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUser(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // Verify product belongs to user
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('id', params.id)
      .eq('userId', user.id)
      .single();
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    // Competitor limit per product
    const { count: existing } = await supabase
      .from('competitors')
      .select('*', { count: 'exact', head: true })
      .eq('productId', params.id);

    const limit = TIER_COMPETITOR_LIMITS[user.subscriptionTier] ?? 5;
    if ((existing ?? 0) >= limit) {
      return NextResponse.json(
        { error: `Límite de ${limit} competidores por producto en tu plan.` },
        { status: 403 }
      );
    }

    const { url, name: manualName } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL requerida' }, { status: 400 });

    const sec = validateUrl(url);
    if (!sec.valid) return NextResponse.json({ error: sec.error }, { status: 400 });

    const brandName = getBrandName(url);

    // Scrape with timeout
    const scraped = await Promise.race([
      scrapeProduct(url),
      new Promise<{ success: false; error: string }>((resolve) =>
        setTimeout(() => resolve({ success: false, error: 'timeout' }), 7000)
      ),
    ]);

    const name = ('data' in scraped && scraped.data?.name) ? scraped.data.name : (manualName ?? brandName);
    const price = ('data' in scraped && scraped.data?.price) ? scraped.data.price : null;
    const currency = ('data' in scraped && scraped.data?.currency) ? scraped.data.currency : 'ARS';
    const imageUrl = ('data' in scraped && scraped.data?.imageUrl) ? scraped.data.imageUrl : null;

    const { data: competitor, error } = await supabase
      .from('competitors')
      .insert({
        productId: params.id,
        name,
        url,
        marketplace: brandName,
        currentPrice: price,
        currency,
        imageUrl,
        lastScrapedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /competitors] Insert error:', error);
      return NextResponse.json({ error: 'Error al guardar el competidor', detail: error.message }, { status: 500 });
    }

    if (price) {
      await supabase.from('price_history').insert({
        competitorId: competitor.id,
        price,
        currency,
      });
    }

    return NextResponse.json(competitor, { status: 201 });
  } catch (e) {
    console.error('[POST /competitors] Unhandled:', e);
    return NextResponse.json({ error: 'Error interno', detail: String(e) }, { status: 500 });
  }
}
