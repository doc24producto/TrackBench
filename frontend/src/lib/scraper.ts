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
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0',
};

// ─── Seguridad ─────────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /^(localhost|127\.|0\.0\.0\.0|::1)/i,
  /^10\.\d+\.\d+\.\d+/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /^192\.168\.\d+\.\d+/,
];

export function validateUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return { valid: false, error: 'URL inválida' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Solo se permiten URLs http/https' };
  }
  const host = parsed.hostname;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(host)) return { valid: false, error: 'URL no permitida' };
  }
  if (!host.includes('.')) return { valid: false, error: 'Dominio inválido' };
  return { valid: true };
}

// ─── Detección de marketplace ──────────────────────────────────────────────────

export function detectMarketplace(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('mercadolibre') || lower.includes('articulo.mercado')) return 'mercadolibre';
  if (lower.includes('amazon')) return 'amazon';
  try {
    const host = new URL(url).hostname.replace('www.', '');
    const parts = host.split('.');
    return parts.length >= 2 ? parts[parts.length - 2] : host;
  } catch { return 'other'; }
}

export function detectCountry(url: string): string {
  if (url.includes('.com.br')) return 'com.br';
  if (url.includes('.com.mx')) return 'com.mx';
  if (url.includes('.com.ar')) return 'com.ar';
  if (url.includes('.com.co')) return 'com.co';
  if (url.includes('.com.cl')) return 'com.cl';
  return 'com';
}

export function getBrandName(url: string): string {
  const mp = detectMarketplace(url);
  if (mp === 'mercadolibre') return 'MercadoLibre';
  if (mp === 'amazon') return 'Amazon';
  try {
    const host = new URL(url).hostname.replace('www.', '');
    const name = host.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch { return mp; }
}

// ─── MercadoLibre ──────────────────────────────────────────────────────────────

function extractMercadoLibreId(url: string): string | null {
  const match = url.match(/ML[A-Z]-?(\d+)/i);
  if (!match) return null;
  const countryCode = url.match(/(MLA|MLB|MLM|MLC|MLU|MLCO)/i)?.[1]?.toUpperCase();
  return countryCode ? `${countryCode}${match[1]}` : null;
}

async function scrapeMercadoLibre(url: string): Promise<ScrapeResult> {
  // ── Catalog URL: /p/MLAxxx ─────────────────────────────────────────────────
  const catalogMatch = url.match(/\/p\/(ML[A-Z]\d+)/i);
  if (catalogMatch) {
    const catalogId = catalogMatch[1].toUpperCase();
    try {
      // Try products API (catalog)
      const { data } = await axios.get(
        `https://api.mercadolibre.com/products/${catalogId}`,
        { timeout: 8000 }
      );
      const price = data.buy_box_winner?.price ?? null;
      const currency = data.buy_box_winner?.currency_id ?? 'ARS';
      const imageUrl = data.pictures?.[0]?.url?.replace('http://', 'https://') ?? null;
      return {
        success: true,
        data: { name: data.name, price, currency, imageUrl, sku: catalogId },
      };
    } catch {
      // Fall through to item ID extraction below
    }
  }

  // ── Item URL ───────────────────────────────────────────────────────────────
  const itemId = extractMercadoLibreId(url);
  if (!itemId) {
    return { success: false, error: 'No se pudo extraer el ID del producto de MercadoLibre. Verificá que la URL sea de un producto específico.' };
  }

  try {
    const { data } = await axios.get(
      `https://api.mercadolibre.com/items/${itemId}`,
      { timeout: 8000 }
    );
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
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } }).response?.status;
    if (status === 404) return { success: false, error: 'Producto no encontrado en MercadoLibre. Verificá que la URL sea válida.' };
    return { success: false, error: 'No se pudo conectar con MercadoLibre. Intentá de nuevo en un momento.' };
  }
}

// ─── Amazon ────────────────────────────────────────────────────────────────────

async function scrapeAmazon(url: string): Promise<ScrapeResult> {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(res.data);
    const name = $('#productTitle').text().trim();
    if (!name) return { success: false, error: 'Amazon bloqueó la solicitud. Ingresá los datos manualmente.' };

    const priceWhole = $('.a-price-whole').first().text().replace(/\D/g, '');
    const priceFraction = $('.a-price-fraction').first().text().replace(/\D/g, '');
    const price = priceWhole ? parseFloat(`${priceWhole}.${priceFraction || '00'}`) : null;
    const imageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src') || null;
    const sku = $('[data-asin]').first().attr('data-asin') || null;
    const currency = url.includes('.com.br') ? 'BRL' : url.includes('.com.mx') ? 'MXN' : 'USD';

    return { success: true, data: { name, price, currency, imageUrl, sku } };
  } catch {
    return { success: false, error: 'Amazon bloqueó la solicitud. Ingresá los datos manualmente.' };
  }
}

// ─── Genérico ──────────────────────────────────────────────────────────────────

function parsePrice(text: string): number | null {
  if (!text) return null;
  // Remove currency symbols and non-numeric chars except . and ,
  // Handle formats: 1.234,56 → 1234.56  |  1,234.56 → 1234.56  |  1234.56 → 1234.56
  const cleaned = text.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;

  let normalized: string;
  const commaIdx = cleaned.lastIndexOf(',');
  const dotIdx = cleaned.lastIndexOf('.');

  if (commaIdx > dotIdx) {
    // Format: 1.234,56 (European/LATAM)
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Format: 1,234.56 (US) or plain 1234.56
    normalized = cleaned.replace(/,/g, '');
  }

  const num = parseFloat(normalized);
  return !isNaN(num) && num > 0 ? num : null;
}

async function scrapeGeneric(url: string): Promise<ScrapeResult> {
  let html: string;
  try {
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: 12000,
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: (s) => s < 400, // no lanzar en 3xx
    });
    // Si no es HTML, no podemos parsear
    const contentType = res.headers['content-type'] ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { success: false, error: 'El sitio no devolvió una página HTML parseable.' };
    }
    html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } }).response?.status;
    if (status === 403 || status === 401) {
      return { success: false, error: 'El sitio bloqueó el acceso automático (protección anti-bot). Ingresá los datos manualmente.' };
    }
    if (status === 404) return { success: false, error: 'Página no encontrada. Verificá que la URL sea correcta.' };
    return { success: false, error: 'No se pudo acceder al sitio. Ingresá los datos manualmente.' };
  }

  const $ = cheerio.load(html);

  // ── 1. JSON-LD (estándar ecommerce: Shopify, WooCommerce, Tiendanube) ────────
  let jsonLdResult: ScrapeResult | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdResult?.success) return;
    try {
      const raw = $(el).text().trim();
      if (!raw) return;
      const json = JSON.parse(raw);
      const nodes = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json];
      const product = nodes.find((n: { '@type': string }) =>
        n['@type'] === 'Product' || n['@type'] === 'IndividualProduct'
      );
      if (!product) return;

      const name = product.name;
      if (!name) return;

      const imageUrl = Array.isArray(product.image)
        ? product.image[0]
        : typeof product.image === 'object'
        ? product.image?.url ?? null
        : product.image ?? null;

      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const price = offer?.price ? parseFloat(String(offer.price)) : null;
      const currency = offer?.priceCurrency ?? 'ARS';
      const sku = product.sku ?? product.mpn ?? null;

      jsonLdResult = { success: true, data: { name, price, currency, imageUrl, sku } };
    } catch { /* JSON inválido, continuar */ }
  });
  if (jsonLdResult) return jsonLdResult;

  // ── 2. Next.js __NEXT_DATA__ (Next.js apps: muchas tiendas modernas) ─────────
  const nextDataEl = $('script#__NEXT_DATA__').text().trim();
  if (nextDataEl) {
    try {
      const nextJson = JSON.parse(nextDataEl);
      // Buscar datos de producto en la estructura de Next.js
      const pageProps = nextJson?.props?.pageProps;
      const product =
        pageProps?.product ||
        pageProps?.data?.product ||
        pageProps?.initialData?.product ||
        pageProps?.productData ||
        pageProps?.pdp?.product ||
        null;

      if (product) {
        const name = product.name || product.title || product.displayName;
        if (name) {
          const price =
            product.price?.current?.value ??
            product.price?.value ??
            product.currentPrice ??
            product.priceRange?.minVariantPrice?.amount ??
            null;

          const currency =
            product.price?.current?.currency ??
            product.price?.currency ??
            product.currency ??
            product.priceRange?.minVariantPrice?.currencyCode ??
            'ARS';

          const imageUrl =
            product.images?.[0]?.url ??
            product.image?.url ??
            product.primaryImage?.url ??
            product.thumbnail ??
            null;

          const sku = product.sku ?? product.id ?? null;

          return {
            success: true,
            data: {
              name: String(name).trim(),
              price: price ? parseFloat(String(price)) : null,
              currency: String(currency),
              imageUrl: imageUrl ? String(imageUrl) : null,
              sku: sku ? String(sku) : null,
            },
          };
        }
      }
    } catch { /* continuar */ }
  }

  // ── 3. Open Graph + meta tags ──────────────────────────────────────────────
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content') ?? null;
  const metaPrice = $('meta[property="product:price:amount"]').attr('content');
  const metaCurrency = $('meta[property="product:price:currency"]').attr('content') ?? 'ARS';

  // ── 4. Precio desde selectores comunes ────────────────────────────────────
  const priceSelectors = [
    '[data-price]', '[data-product-price]',
    '[itemprop="price"]',
    '[class*="price-current"]', '[class*="current-price"]',
    '[class*="precio-actual"]', '[class*="precio_actual"]',
    '[class*="price__current"]', '[class*="price__amount"]',
    '[class*="ProductPrice"]', '[class*="product-price"]',
    '[class*="precio"]', '[class*="price"]',
    '.price', '#price', '.Price',
  ];

  let scrapedPrice: number | null = metaPrice ? parsePrice(metaPrice) : null;
  if (!scrapedPrice) {
    for (const selector of priceSelectors) {
      const el = $(selector).first();
      if (!el.length) continue;
      const text =
        el.attr('data-price') ??
        el.attr('content') ??
        el.attr('data-product-price') ??
        el.attr('data-price-amount') ??
        el.text();
      const p = parsePrice(text || '');
      if (p && p > 0) { scrapedPrice = p; break; }
    }
  }

  // ── 5. Imagen ──────────────────────────────────────────────────────────────
  const imgSelectors = [
    '[class*="product"] img[src*="http"]',
    '[class*="gallery"] img[src*="http"]',
    '#product-image', '.product-image img',
    'img[itemprop="image"]',
  ];
  let scrapedImg: string | null = ogImage;
  if (!scrapedImg) {
    for (const selector of imgSelectors) {
      const src = $(selector).first().attr('src') || $(selector).first().attr('data-src');
      if (src && src.startsWith('http')) { scrapedImg = src; break; }
    }
  }

  // ── 6. Nombre ──────────────────────────────────────────────────────────────
  const name =
    ogTitle ||
    $('h1[class*="product"]').first().text().trim() ||
    $('h1[class*="title"]').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('title').text().trim().split('|')[0].split('–')[0].trim();

  if (!name) return { success: false, error: 'No se pudo leer el producto automáticamente. El sitio puede estar protegido o requerir JavaScript.' };

  return {
    success: true,
    data: { name: name.trim(), price: scrapedPrice, currency: metaCurrency, imageUrl: scrapedImg, sku: null },
  };
}

// ─── Función principal ─────────────────────────────────────────────────────────

export async function scrapeProduct(url: string): Promise<ScrapeResult> {
  const security = validateUrl(url);
  if (!security.valid) return { success: false, error: security.error };

  const lower = url.toLowerCase();
  if (lower.includes('mercadolibre') || lower.includes('articulo.mercado')) {
    return scrapeMercadoLibre(url);
  }
  if (lower.includes('amazon')) {
    return scrapeAmazon(url);
  }
  return scrapeGeneric(url);
}
