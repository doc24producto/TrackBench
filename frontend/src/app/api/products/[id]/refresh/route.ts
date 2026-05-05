import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';
import { scrapeProduct } from '@/lib/scraper';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: product } = await supabase.from('products')
    .select('*, competitors(id, url)').eq('id', params.id).eq('userId', user.id).single();
  if (!product) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const scraped = await scrapeProduct(product.url);
  if (scraped.success && scraped.data) {
    await supabase.from('products').update({
      currentPrice: scraped.data.price,
      imageUrl: scraped.data.imageUrl || product.imageUrl,
      lastScrapedAt: new Date().toISOString(),
    }).eq('id', product.id);

    if (scraped.data.price) {
      await supabase.from('price_history').insert({
        productId: product.id, price: scraped.data.price, currency: scraped.data.currency,
      });
    }
  }

  for (const comp of product.competitors || []) {
    const cs = await scrapeProduct(comp.url);
    if (cs.success && cs.data) {
      await supabase.from('competitors').update({
        currentPrice: cs.data.price,
        lastScrapedAt: new Date().toISOString(),
      }).eq('id', comp.id);
      if (cs.data.price) {
        await supabase.from('price_history').insert({
          competitorId: comp.id, price: cs.data.price, currency: cs.data.currency,
        });
      }
    }
  }

  return NextResponse.json({ message: 'Actualizado' });
}
