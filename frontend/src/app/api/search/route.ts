/**
 * GET /api/search?q={query}&country={AR|BR|MX|CL|CO|UY}
 *
 * Search MercadoLibre by keyword OR GTIN/EAN barcode.
 * Returns top 5 matches with price, title, thumbnail, and item URL.
 * Used by the "Add Product" and "Add Competitor" modals.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import axios from 'axios';

const SITE_MAP: Record<string, string> = {
  AR: 'MLA', BR: 'MLB', MX: 'MLM', CL: 'MLC', CO: 'MLCO', UY: 'MLU', PE: 'MLPE',
};

const ML = axios.create({ baseURL: 'https://api.mercadolibre.com', timeout: 6000 });

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim();
  const country = (req.nextUrl.searchParams.get('country') ?? 'AR').toUpperCase();
  if (!q) return NextResponse.json({ error: 'Parámetro q requerido' }, { status: 400 });

  const site = SITE_MAP[country] ?? 'MLA';

  try {
    const { data } = await ML.get(`/sites/${site}/search`, {
      params: { q, limit: 6 },
    });

    const results = (data?.results ?? []).slice(0, 6).map((item: {
      id: string; title: string; price: number; currency_id: string;
      thumbnail: string; permalink: string; seller: { id: number };
    }) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      currency: item.currency_id,
      thumbnail: item.thumbnail?.replace('http://', 'https://'),
      url: item.permalink,
      sellerId: item.seller?.id,
    }));

    return NextResponse.json({ results, site, query: q });
  } catch (e: unknown) {
    console.error('[GET /api/search] ML API error:', e);
    return NextResponse.json({ error: 'Error al buscar en MercadoLibre', results: [] }, { status: 502 });
  }
}
