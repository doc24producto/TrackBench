import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  success: boolean;
  data?: {
    name: string;
    price: number | null;
    currency: string;
    imageUrl: string | null;
    sku: string | null;
  };
  error?: string;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
};

export async function scrapeProduct(url: string): Promise<ScrapeResult> {
  try {
    const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    const $ = cheerio.load(html);

    if (url.includes('mercadolibre')) return scrapeMercadoLibre($, url);
    if (url.includes('amazon')) return scrapeAmazon($, url);
    return scrapeGeneric($, url);
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

function scrapeMercadoLibre($: cheerio.CheerioAPI, url: string): ScrapeResult {
  const name = $('h1.ui-pdp-title').first().text().trim() ||
               $('[class*="title"]').first().text().trim();

  const priceText = $('.andes-money-amount__fraction').first().text().replace(/\D/g, '');
  const price = priceText ? parseInt(priceText, 10) : null;

  const currency = url.includes('.com.br') ? 'BRL' :
                   url.includes('.com.mx') ? 'MXN' : 'ARS';

  const imageUrl = $('.ui-pdp-image').first().attr('src') || null;

  if (!name) return { success: false, error: 'No se pudo extraer el nombre del producto' };
  return { success: true, data: { name, price, currency, imageUrl, sku: null } };
}

function scrapeAmazon($: cheerio.CheerioAPI, _url: string): ScrapeResult {
  const name = $('#productTitle').text().trim();
  const priceText = $('.a-price-whole').first().text().replace(/\D/g, '');
  const price = priceText ? parseInt(priceText, 10) : null;
  const imageUrl = $('#landingImage').attr('src') || null;
  const sku = $('[data-asin]').first().attr('data-asin') || null;

  if (!name) return { success: false, error: 'No se pudo extraer el nombre del producto' };
  return { success: true, data: { name, price, currency: 'USD', imageUrl, sku } };
}

function scrapeGeneric($: cheerio.CheerioAPI, _url: string): ScrapeResult {
  const name = $('h1').first().text().trim() ||
               $('title').text().trim();

  if (!name) return { success: false, error: 'No se pudo leer el producto automáticamente' };
  return { success: true, data: { name, price: null, currency: 'ARS', imageUrl: null, sku: null } };
}

export function detectMarketplace(url: string): string {
  if (url.includes('amazon')) return 'amazon';
  if (url.includes('mercadolibre') || url.includes('articulo.mercado')) return 'mercadolibre';
  return 'shopify';
}

export function detectCountry(url: string): string {
  if (url.includes('.com.br')) return 'com.br';
  if (url.includes('.com.mx')) return 'com.mx';
  if (url.includes('.com.ar')) return 'com.ar';
  return 'com';
}
