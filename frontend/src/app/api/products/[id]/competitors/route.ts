import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUser } from '@/lib/auth';
import { scrapeProduct, detectMarketplace } from '@/lib/scraper';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: product } = await supabase.from('products')
    .select('id').eq('id', params.id).eq('userId', user.id).single();
  if (!product) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const { url, name: manualName } = await req.json();
  if (!url) return NextResponse.json({ error: 'URL requerida' }, { status: 400 });

  const marketplace = detectMarketplace(url);
  const scraped = await scrapeProduct(url);

  const name = scraped.data?.name || manualName || 'Competidor';
  const { data: competitor, error } = await supabase.from('competitors').insert({
    productId: params.id,
    name,
    url,
    marketplace,
    currentPrice: scraped.data?.price ?? null,
    currency: scraped.data?.currency ?? 'ARS',
    imageUrl: scraped.data?.imageUrl ?? null,
    lastScrapedAt: new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });

  if (scraped.data?.price) {
    await supabase.from('price_history').insert({
      competitorId: competitor.id, price: scraped.data.price, currency: scraped.data.currency,
    });
  }

  return NextResponse.json(competitor, { status: 201 });
}
