/**
 * scraper.ts
 *
 * Strategy per marketplace:
 *  • MercadoLibre  → official public Items/Products API (no auth, never blocked, ~300 ms)
 *  • Amazon        → HTML scraping with Cheerio (often blocked; graceful fallback to manual)
 *  • Tiendanube    → JSON-LD (they embed it correctly)
 *  • Generic       → JSON-LD → __NEXT_DATA__ → Open Graph → CSS selectors
 *
 * All helpers are exported so route handlers can reuse them.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScrapeData {
  name: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  sku: string | null;
  brand: string | null;
  description: string | null;
  isAvailable: boolean;
  rating: number | null;
  reviewCount: number | null;
}

export interface ScrapeResult {
  success: boolean;
  data?: ScrapeData;
  error?: string;
  source?: string; // 'ml_items_api' | 'ml_products_api' | 'ml_search_api' | 'amazon_html' | 'json_ld' | 'og' | 'manual'
}

// ── Security ─────────────────────────────────────────────────────────────────

const PRIVATE_IP = [
  /^(localhost|127\.|0\.0\.0\.0|::1)/i,
  /^10\.\d+\.\d+\.\d+/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /^192\.168\.\d+\.\d+/,
];

export function validateUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return { valid: false, error: 'URL inválida. Verificá que empiece con https://' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Solo se permiten URLs http/https' };
  }
  const host = parsed.hostname;
  for (const p of PRIVATE_IP) {
    if (p.test(host)) return { valid: false, error: 'URL de red privada no permitida' };
  }
  if (!host.includes('.')) return { valid: false, error: 'Dominio inválido' };
  return { valid: true };
}

// ── Marketplace detection ─────────────────────────────────────────────────────

export function detectMarketplace(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('mercadolibre') || lower.includes('articulo.mercado') || lower.includes('listado.mercado')) return 'mercadolibre';
  if (lower.includes('amazon')) return 'amazon';
  if (lower.includes('tiendanube') || lower.includes('nuvemshop') || lower.includes('mitienda')) return 'tiendanube';
  if (lower.includes('shopify')) return 'shopify';
  if (lower.includes('falabella')) return 'falabella';
  if (lower.includes('rappi')) return 'rappi';
  try {
    const host = new URL(url).hostname.replace('www.', '');
    const parts = host.split('.');
    return parts.length >= 2 ? parts[parts.length - 2] : host;
  } catch { return 'other'; }
}

export function detectCountry(url: string): string {
  if (url.includes('.com.ar')) return 'AR';
  if (url.includes('.com.br')) return 'BR';
  if (url.includes('.com.mx')) return 'MX';
  if (url.includes('.com.co')) return 'CO';
  if (url.includes('.com.cl')) return 'CL';
  if (url.includes('.com.uy')) return 'UY';
  if (url.includes('.com.pe')) return 'PE';
  return 'COM';
}

export function getBrandName(url: string): string {
  const mp = detectMarketplace(url);
  const NAMES: Record<string, string> = {
    mercadolibre: 'MercadoLibre',
    amazon: 'Amazon',
    tiendanube: 'Tiendanube',
    shopify: 'Shopify',
    falabella: 'Falabella',
    rappi: 'Rappi',
  };
  if (NAMES[mp]) return NAMES[mp];
  try {
    const host = new URL(url).hostname.replace('www.', '');
    const name = host.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch { return mp; }
}

// ── MercadoLibre — Official API (primary path) ────────────────────────────────

type MLSite = 'MLA' | 'MLB' | 'MLM' | 'MLC' | 'MLCO' | 'MLU' | 'MLPE';

function getMLSite(url: string): MLSite {
  if (url.includes('.com.ar')) return 'MLA';
  if (url.includes('.com.br')) return 'MLB';
  if (url.includes('.com.mx')) return 'MLM';
  if (url.includes('.com.cl')) return 'MLC';
  if (url.includes('.com.co')) return 'MLCO';
  if (url.includes('.com.uy')) return 'MLU';
  if (url.includes('.com.pe')) return 'MLPE';
  return 'MLA';
}

/**
 * Extracts MercadoLibre item or product IDs from any ML URL.
 *
 * Formats encountered in the wild:
 *  - Catalog page:  .../Title/p/MLA30305877
 *  - Item via subdomain: articulo.mercadolibre.com.ar/MLA-2958043267-title-_JM
 *  - Item embedded: .../MLA-2958043267-..._JM (in listings)
 *  - Old-style item: ends with _JM, ID in path
 */
function extractMLIds(url: string): { itemId?: string; productId?: string } {
  // Catalog product page — /p/MLA12345678 (at end of path or before query)
  const catalogMatch = url.match(/\/p\/(ML[A-Z]+\d+)(?:[/#?]|$)/i);
  if (catalogMatch) {
    return { productId: catalogMatch[1].toUpperCase() };
  }

  // Item ID — ML[country_code]-[digits] anywhere in the URL
  const itemMatch = url.match(/\b(ML[A-Z]{1,4})-?(\d{5,12})\b/i);
  if (itemMatch) {
    return { itemId: `${itemMatch[1].toUpperCase()}${itemMatch[2]}` };
  }

  return {};
}

const ML_API = axios.create({ baseURL: 'https://api.mercadolibre.com', timeout: 6000 });

async function fetchMLItem(itemId: string): Promise<ScrapeResult> {
  const { data } = await ML_API.get(`/items/${itemId}`);
  if (!data?.title) return { success: false, error: 'Respuesta inesperada de la API de MercadoLibre.' };
  return {
    success: true,
    source: 'ml_items_api',
    data: {
      name: data.title,
      price: data.price ?? null,
      currency: data.currency_id ?? 'ARS',
      imageUrl: data.thumbnail?.replace('http://', 'https://') ?? data.pictures?.[0]?.url ?? null,
      sku: data.id ?? null,
      brand: data.attributes?.find((a: { id: string; value_name: string }) => a.id === 'BRAND')?.value_name ?? null,
      description: null,
      isAvailable: data.status === 'active',
      rating: data.seller_reputation?.level_id ? null : null,
      reviewCount: data.reviews?.rating_average ? null : null,
    },
  };
}

async function fetchMLProduct(productId: string): Promise<ScrapeResult> {
  const { data } = await ML_API.get(`/products/${productId}`);
  if (!data?.name) return { success: false, error: 'Producto no encontrado en MercadoLibre.' };
  return {
    success: true,
    source: 'ml_products_api',
    data: {
      name: data.name,
      price: data.buy_box_winner?.price ?? null,
      currency: data.buy_box_winner?.currency_id ?? 'ARS',
      imageUrl: data.pictures?.[0]?.url ?? null,
      sku: data.id ?? null,
      brand: data.attributes?.find((a: { id: string; value_name: string }) => a.id === 'BRAND')?.value_name ?? null,
      description: data.short_description?.content ?? null,
      isAvailable: true,
      rating: data.reviews?.rating_average ?? null,
      reviewCount: data.reviews?.total ?? null,
    },
  };
}

/** Search ML by query string — last resort fallback when we can't extract an ID */
async function searchML(query: string, site: MLSite): Promise<ScrapeResult> {
  const { data } = await ML_API.get(`/sites/${site}/search`, {
    params: { q: query.slice(0, 80), limit: 1 },
  });
  const first = data?.results?.[0];
  if (!first?.title) return { success: false, error: 'No se encontraron resultados en MercadoLibre.' };
  return {
    success: true,
    source: 'ml_search_api',
    data: {
      name: first.title,
      price: first.price ?? null,
      currency: first.currency_id ?? 'ARS',
      imageUrl: first.thumbnail?.replace('http://', 'https://') ?? null,
      sku: first.id ?? null,
      brand: null,
      description: null,
      isAvailable: first.listing_type_id !== 'bronze',
      rating: null,
      reviewCount: null,
    },
  };
}

export async function scrapeMercadoLibre(url: string): Promise<ScrapeResult> {
  const site = getMLSite(url);
  const { itemId, productId } = extractMLIds(url);

  // ── 1. Catalog product page
  if (productId) {
    try {
      return await fetchMLProduct(productId);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      if (status === 404) return { success: false, error: 'Producto no encontrado en MercadoLibre. Verificá la URL.' };
      // Fallthrough to item attempt
    }
  }

  // ── 2. Direct item ID
  if (itemId) {
    try {
      return await fetchMLItem(itemId);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } }).response?.status;
      if (status === 404) return { success: false, error: 'Publicación no encontrada en MercadoLibre. Verificá la URL.' };
      // Fallthrough to search
    }
  }

  // ── 3. Build a search query from the URL slug (last fallback)
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const ignored = new Set(['up', 'p', 'jm', 'listado', 'noindex', 'ofertas', 'mas-vendidos']);
    const slug = segments.find(s => s.length > 4 && !ignored.has(s.toLowerCase()) && !/^ML/i.test(s));
    if (slug) {
      const query = decodeURIComponent(slug).replace(/-/g, ' ').trim();
      return await searchML(query, site);
    }
  } catch { /* */ }

  return {
    success: false,
    error: 'No pudimos identificar el producto en esta URL de MercadoLibre. Asegurate de pegar la URL de un producto específico, no de una búsqueda.',
  };
}

// ── Amazon ─────────────────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

async function scrapeAmazon(url: string): Promise<ScrapeResult> {
  try {
    const res = await axios.get(url, { headers: BROWSER_HEADERS, timeout: 5000 });
    const $ = cheerio.load(res.data);
    const name = $('#productTitle').text().trim();
    if (!name) {
      return { success: false, error: 'Amazon bloquea el acceso automático desde servidores. Ingresá los datos manualmente.' };
    }
    const priceWhole = $('.a-price-whole').first().text().replace(/\D/g, '');
    const priceFraction = $('.a-price-fraction').first().text().replace(/\D/g, '');
    const price = priceWhole ? parseFloat(`${priceWhole}.${priceFraction || '00'}`) : null;
    const imageUrl = $('#landingImage, #imgBlkFront').first().attr('src') ?? null;
    const asin = $('[data-asin]').first().attr('data-asin') ?? null;
    const currency = url.includes('.com.br') ? 'BRL' : url.includes('.com.mx') ? 'MXN' : 'USD';
    const rating = parseFloat($('#acrPopover').attr('title') ?? '') || null;
    const reviewCount = parseInt($('#acrCustomerReviewText').text().replace(/\D/g, '') ?? '') || null;
    return {
      success: true,
      source: 'amazon_html',
      data: { name, price, currency, imageUrl, sku: asin, brand: null, description: null, isAvailable: true, rating, reviewCount },
    };
  } catch {
    return { success: false, error: 'Amazon bloquea el acceso automático desde servidores. Ingresá los datos manualmente.' };
  }
}

// ── Generic / JSON-LD ──────────────────────────────────────────────────────────

function parsePrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;
  const commaIdx = cleaned.lastIndexOf(',');
  const dotIdx = cleaned.lastIndexOf('.');
  const normalized = commaIdx > dotIdx
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');
  const num = parseFloat(normalized);
  return !isNaN(num) && num > 0 && num < 1_000_000_000 ? num : null;
}

async function scrapeGeneric(url: string): Promise<ScrapeResult> {
  let html: string;
  try {
    const res = await axios.get(url, {
      headers: BROWSER_HEADERS,
      timeout: 6000,
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: (s) => s < 400,
    });
    const ct = String(res.headers['content-type'] ?? '');
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return { success: false, error: 'El sitio no devolvió una página HTML.' };
    }
    html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } }).response?.status;
    if (status === 403 || status === 401) return { success: false, error: 'El sitio bloqueó el acceso. Ingresá los datos manualmente.' };
    if (status === 404) return { success: false, error: 'Página no encontrada. Verificá la URL.' };
    return { success: false, error: 'No se pudo acceder al sitio. Ingresá los datos manualmente.' };
  }

  const $ = cheerio.load(html);

  // ── 1. JSON-LD (most reliable)
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const raw = $(el).text().trim();
      if (!raw) continue;
      const json = JSON.parse(raw);
      const nodes: Record<string, unknown>[] = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json];
      const product = nodes.find((n) => n['@type'] === 'Product' || n['@type'] === 'IndividualProduct');
      if (!product?.name) continue;
      const imgRaw = product.image as string | string[] | { url?: string } | null;
      const imageUrl: string | null = Array.isArray(imgRaw)
        ? (imgRaw[0] as string)
        : typeof imgRaw === 'object' && imgRaw !== null
          ? (imgRaw as { url?: string }).url ?? null
          : (imgRaw as string | null);
      const offersRaw = product.offers as Record<string, unknown> | Record<string, unknown>[];
      const offer = Array.isArray(offersRaw) ? offersRaw[0] : offersRaw;
      const price = offer?.price ? parseFloat(String(offer.price)) : null;
      const aggRating = product.aggregateRating as { ratingValue?: number; reviewCount?: number } | null;
      return {
        success: true,
        source: 'json_ld',
        data: {
          name: String(product.name).trim(),
          price,
          currency: String(offer?.priceCurrency ?? 'ARS'),
          imageUrl: imageUrl ?? null,
          sku: product.sku ? String(product.sku) : product.mpn ? String(product.mpn) : null,
          brand: product.brand ? String((product.brand as { name?: string }).name ?? product.brand) : null,
          description: product.description ? String(product.description).slice(0, 300) : null,
          isAvailable: !offer?.availability || String(offer.availability).includes('InStock'),
          rating: aggRating?.ratingValue ?? null,
          reviewCount: aggRating?.reviewCount ?? null,
        },
      };
    } catch { /* */ }
  }

  // ── 2. __NEXT_DATA__ (Next.js stores)
  const nextDataRaw = $('script#__NEXT_DATA__').text().trim();
  if (nextDataRaw) {
    try {
      const nd = JSON.parse(nextDataRaw);
      const pp = nd?.props?.pageProps;
      const p = pp?.product ?? pp?.data?.product ?? pp?.initialData?.product ?? pp?.productData ?? pp?.pdp?.product;
      if (p) {
        const name = String(p.name ?? p.title ?? p.displayName ?? '').trim();
        if (name) {
          const priceRaw = p.price?.current?.value ?? p.price?.value ?? p.currentPrice ?? p.priceRange?.minVariantPrice?.amount ?? null;
          return {
            success: true,
            source: 'next_data',
            data: {
              name,
              price: priceRaw ? parseFloat(String(priceRaw)) : null,
              currency: String(p.price?.current?.currency ?? p.currency ?? p.priceRange?.minVariantPrice?.currencyCode ?? 'ARS'),
              imageUrl: p.images?.[0]?.url ?? p.image?.url ?? p.primaryImage?.url ?? null,
              sku: p.sku ? String(p.sku) : p.id ? String(p.id) : null,
              brand: p.brand ?? null,
              description: p.description ? String(p.description).slice(0, 300) : null,
              isAvailable: p.available !== false,
              rating: null,
              reviewCount: null,
            },
          };
        }
      }
    } catch { /* */ }
  }

  // ── 3. Open Graph + CSS selectors fallback
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const ogImage = $('meta[property="og:image"]').attr('content') ?? null;
  const metaPrice = $('meta[property="product:price:amount"]').attr('content');
  const metaCurrency = $('meta[property="product:price:currency"]').attr('content') ?? 'ARS';

  let price: number | null = metaPrice ? parsePrice(metaPrice) : null;
  if (!price) {
    const PRICE_SELECTORS = [
      '[data-price]', '[data-product-price]', '[itemprop="price"]',
      '[class*="price-current"]', '[class*="current-price"]', '[class*="precio-actual"]',
      '[class*="price__current"]', '[class*="price__amount"]', '[class*="ProductPrice"]',
      '[class*="product-price"]', '[class*="precio"]', '.price', '#price',
    ];
    for (const sel of PRICE_SELECTORS) {
      const el = $(sel).first();
      if (!el.length) continue;
      const text = el.attr('data-price') ?? el.attr('content') ?? el.attr('data-product-price') ?? el.text();
      const p = parsePrice(text || '');
      if (p) { price = p; break; }
    }
  }

  const name = ogTitle
    ?? $('h1[class*="product"]').first().text().trim()
    ?? $('h1[class*="title"]').first().text().trim()
    ?? $('h1').first().text().trim()
    ?? $('title').text().trim().split(/[|–—]/)[0].trim();

  if (!name) {
    return { success: false, error: 'No se pudo leer el producto. El sitio puede requerir JavaScript o estar protegido.' };
  }

  return {
    success: true,
    source: 'og',
    data: { name: name.trim(), price, currency: metaCurrency, imageUrl: ogImage, sku: null, brand: null, description: null, isAvailable: true, rating: null, reviewCount: null },
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function scrapeProduct(url: string): Promise<ScrapeResult> {
  const sec = validateUrl(url);
  if (!sec.valid) return { success: false, error: sec.error };

  const lower = url.toLowerCase();

  if (lower.includes('mercadolibre') || lower.includes('articulo.mercado') || lower.includes('listado.mercado')) {
    return scrapeMercadoLibre(url);
  }
  if (lower.includes('amazon')) {
    return scrapeAmazon(url);
  }
  return scrapeGeneric(url);
}

/**
 * Search MercadoLibre by GTIN / EAN / barcode.
 * Returns the best-matching product found across all ML categories.
 */
export async function searchByGTIN(gtin: string, country = 'AR'): Promise<ScrapeResult> {
  const siteMap: Record<string, string> = { AR: 'MLA', BR: 'MLB', MX: 'MLM', CL: 'MLC', CO: 'MLCO', UY: 'MLU', PE: 'MLPE' };
  const site = siteMap[country.toUpperCase()] ?? 'MLA';
  try {
    const { data } = await ML_API.get(`/sites/${site}/search`, { params: { q: gtin, limit: 1 } });
    const first = data?.results?.[0];
    if (!first?.title) return { success: false, error: `No se encontró ningún producto con GTIN ${gtin} en MercadoLibre.` };
    return {
      success: true,
      source: 'ml_search_api',
      data: {
        name: first.title,
        price: first.price ?? null,
        currency: first.currency_id ?? 'ARS',
        imageUrl: first.thumbnail?.replace('http://', 'https://') ?? null,
        sku: first.id ?? null,
        brand: null,
        description: null,
        isAvailable: true,
        rating: null,
        reviewCount: null,
      },
    };
  } catch {
    return { success: false, error: 'Error al buscar el GTIN en MercadoLibre.' };
  }
}
