import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';
import { scrapeProduct } from '@/lib/scraper';

const SCRAPE_TIMEOUT_MS = 6000;

async function scrapeWithTimeout(url: string) {
  return Promise.race([
    scrapeProduct(url),
    new Promise<{ success: false; error: string }>((resolve) =>
      setTimeout(() => resolve({ success: false, error: 'timeout' }), SCRAPE_TIMEOUT_MS)
    ),
  ]);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUser(req);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data: product } = await supabase
      .from('products')
      .select('id, url, imageUrl, competitors(id, url)')
      .eq('id', params.id)
      .eq('userId', user.id)
      .single();

    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    // ── Refresh own product price ──────────────────────────────────────────────
    const ownScrape = await scrapeWithTimeout(product.url);
    if (ownScrape.success && 'data' in ownScrape && ownScrape.data) {
      await supabase.from('products').update({
        currentPrice: ownScrape.data.price,
        imageUrl: ownScrape.data.imageUrl || product.imageUrl,
        isAvailable: ownScrape.data.isAvailable,
        lastScrapedAt: new Date().toISOString(),
      }).eq('id', product.id);

      if (ownScrape.data.price) {
        await supabase.from('price_history').insert({
          productId: product.id,
          price: ownScrape.data.price,
          currency: ownScrape.data.currency,
        });
      }
    }

    // ── Refresh competitors sequentially (respect Vercel timeout budget) ───────
    const competitors = (product.competitors as { id: string; url: string }[]) ?? [];
    for (const comp of competitors) {
      try {
        const cs = await scrapeWithTimeout(comp.url);
        if (cs.success && 'data' in cs && cs.data) {
          const updates: Record<string, unknown> = {
            currentPrice: cs.data.price,
            isAvailable: cs.data.isAvailable,
            lastScrapedAt: new Date().toISOString(),
          };
          if (cs.data.imageUrl) updates.imageUrl = cs.data.imageUrl;

          await supabase.from('competitors').update(updates).eq('id', comp.id);

          if (cs.data.price) {
            await supabase.from('price_history').insert({
              competitorId: comp.id,
              price: cs.data.price,
              currency: cs.data.currency,
            });
          }
        }
      } catch (e) {
        console.warn(`[refresh] Failed to scrape competitor ${comp.id}:`, e);
        // Continue with remaining competitors
      }
    }

    return NextResponse.json({ ok: true, message: 'Precios actualizados' });
  } catch (e) {
    console.error('[POST /refresh] Unhandled:', e);
    return NextResponse.json({ error: 'Error al actualizar', detail: String(e) }, { status: 500 });
  }
}
