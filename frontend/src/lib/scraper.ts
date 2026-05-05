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
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
};

// ─── Seguridad ────────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /^(localhost|127\.|0\.0\.0\.0|::1)/i,
  /^10\.\d+\.\d+\.\d+/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /^192\.168\.\d+\.\d+/,
];

export function validateUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'URL inválida' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Solo se permiten URLs http/https' };
  }

  const host = parsed.hostname;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(host)) {
      return { valid: false, error: 'URL no permitida' };
    }
  }

  if (!host.includes('.')) {
    return { valid: false, error: 'Dominio inválido' };
  }

  return { valid: true };
}

// ─── Detección de marketplace ─────────────────────────────────────────────────

const KNOWN_MARKETPLACES: Record<string, string> = {
  'mercadolibre': 'mercadolibre',
  'mercado libre': 'mercadolibre',
  'articulo.mercado': 'mercadolibre',
  'amazon': 'amazon',
};

export function detectMarketplace(url: string): string {
  const lower = url.toLowerCase();
  for (const [key, value] of Object.entries(KNOWN_MARKETPLACES)) {
    if (lower.includes(key)) return value;
  }
  // Para cualquier otra tienda, devolvemos el dominio limpio como marketplace
  try {
    const host = new URL(url).hostname.replace('www.', '');
    const parts = host.split('.');
    return parts.length >= 2 ? parts[parts.length - 2] : host;
  } catch {
    return 'other';
  }
}

export function detectCountry(url: string): string {
  if (url.includes('.com.br')) return 'com.br';
  if (url.includes('.com.mx')) return 'com.mx';
  if (url.includes('.com.ar')) return 'com.ar';
  if (url.includes('.com.co')) return 'com.co';
  if (url.includes('.com.cl')) return 'com.cl';
  return 'com';
}

// ─── Nombre de marca para mostrar ────────────────────────────────────────────

export function getBrandName(url: string): string {
  const marketplace = detectMarketplace(url);
  if (marketplace === 'mercadolibre') return 'MercadoLibre';
  if (marketplace === 'amazon') return 'Amazon';
  try {
    const host = new URL(url).hostname.replace('www.', '');
    const name = host.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return marketplace;
  }
}

// ─── MercadoLibre via API pública ─────────────────────────────────────────────

function extractMercadoLibreId(url: string): string | null {
  // Formato: MLA123456789, MLB123456789, MLM123456789, etc.
  const match = url.match(/ML[A-Z]-?(\d+)/i);
  if (!match) return null;
  const countryCode = url.match(/(MLA|MLB|MLM|MLC|MLU|MLCO)/i)?.[1]?.toUpperCase();
  return countryCode ? `${countryCode}${match[1]}` : null;
}

async function scrapeMercadoLibre(url: string): Promise<ScrapeResult> {
  const itemId = extractMercadoLibreId(url);
  if (!itemId) {
    return { success: false, error: 'No se pudo extraer el ID del producto de MercadoLibre' };
  }

  try {
    const { data } = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, { timeout: 8000 });
    return {
      success: true,
      data: {
        name: data.title,
        price: data.price ?? null,
        currency: data.currency_id ?? 'ARS',
        imageUrl: data.thumbnail?.replace('http://', 'https://') ?? null,
        sku: data.id ?? null,
      },
    };
  } catch {
    return { success: false, error: 'No se pudo obtener datos de MercadoLibre' };
  }
}

// ─── Scraping genérico (cualquier tienda) ─────────────────────────────────────

async function scrapeGeneric(url: string): Promise<ScrapeResult> {
  let html: string;
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    html = res.data;
  } catch {
    return { success: false, error: 'No se pudo acceder al sitio' };
  }

  const $ = cheerio.load(html);

  // 1. JSON-LD (estándar de ecommerce — funciona en Shopify, WooCommerce, Tiendanube, etc.)
  let jsonLdResult: ScrapeResult | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdResult?.success) return;
    try {
      const json = JSON.parse($(el).text());
      const product = json['@type'] === 'Product' ? json : json['@graph']?.find((n: { '@type': string }) => n['@type'] === 'Product');
      if (!product) return;

      const name = product.name;
      const imageUrl = Array.isArray(product.image) ? product.image[0] : product.image ?? null;
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const price = offer?.price ? parseFloat(String(offer.price)) : null;
      const currency = offer?.priceCurrency ?? 'ARS';
      const sku = product.sku ?? product.mpn ?? null;

      if (name) {
        jsonLdResult = { success: true, data: { name, price, currency, imageUrl, sku } };
      }
    } catch { /* ignorar JSON inválido */ }
  });
  if (jsonLdResult) return jsonLdResult;

  // 2. Open Graph + meta tags
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content') ?? null;
  const metaPrice = $('meta[property="product:price:amount"]').attr('content');
  const metaCurrency = $('meta[property="product:price:currency"]').attr('content') ?? 'ARS';

  // 3. Precio desde selectores comunes de ecommerce
  const priceSelectors = [
    '[class*="price"][class*="current"]', '[class*="precio"][class*="actual"]',
    '[class*="product-price"]', '[class*="precio"]', '[class*="price"]',
    '.price', '#price', '[itemprop="price"]',
    '[data-price]', '[data-product-price]',
  ];

  let scrapedPrice: number | null = metaPrice ? parseFloat(metaPrice) : null;
  if (!scrapedPrice) {
    for (const selector of priceSelectors) {
      const el = $(selector).first();
      if (!el.length) continue;
      const attrPrice = el.attr('data-price') || el.attr('content') || el.attr('data-product-price');
      const textPrice = attrPrice || el.text();
      const cleaned = textPrice.replace(/[^\d.,]/g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0) { scrapedPrice = num; break; }
    }
  }

  // 4. Imagen desde selectores comunes
  const imgSelectors = [
    '[class*="product"] img', '[class*="gallery"] img',
    '#product-image', '.product-image img', 'img[itemprop="image"]',
  ];
  let scrapedImg: string | null = ogImage;
  if (!scrapedImg) {
    for (const selector of imgSelectors) {
      const src = $(selector).first().attr('src') || $(selector).first().attr('data-src');
      if (src && src.startsWith('http')) { scrapedImg = src; break; }
    }
  }

  const name = ogTitle || $('h1').first().text().trim() || $('title').text().trim();
  if (!name) return { success: false, error: 'No se pudo leer el producto automáticamente' };

  return {
    success: true,
    data: {
      name: name.trim(),
      price: scrapedPrice,
      currency: metaCurrency,
      imageUrl: scrapedImg,
      sku: null,
    },
  };
}

// ─── Scraping de Amazon ───────────────────────────────────────────────────────

async function scrapeAmazon(url: string): Promise<ScrapeResult> {
  let html: string;
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    html = res.data;
  } catch {
    return { success: false, error: 'Amazon bloqueó la solicitud. Ingresá los datos manualmente.' };
  }
  const $ = cheerio.load(html);
  const name = $('#productTitle').text().trim();
  if (!name) return { success: false, error: 'Amazon bloqueó la solicitud. Ingresá los datos manualmente.' };

  const priceWhole = $('.a-price-whole').first().text().replace(/\D/g, '');
  const priceFraction = $('.a-price-fraction').first().text().replace(/\D/g, '');
  const price = priceWhole ? parseFloat(`${priceWhole}.${priceFraction || '00'}`) : null;
  const imageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src') || null;
  const sku = $('[data-asin]').first().attr('data-asin') || null;
  const currency = url.includes('.com.br') ? 'BRL' : url.includes('.com.mx') ? 'MXN' : 'USD';

  return { success: true, data: { name, price, currency, imageUrl, sku } };
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function scrapeProduct(url: string): Promise<ScrapeResult> {
  const security = validateUrl(url);
  if (!security.valid) return { success: false, error: security.error };

  if (url.toLowerCase().includes('mercadolibre') || url.toLowerCase().includes('articulo.mercado')) {
    return scrapeMercadoLibre(url);
  }
  if (url.toLowerCase().includes('amazon')) {
    return scrapeAmazon(url);
  }
  return scrapeGeneric(url);
}
