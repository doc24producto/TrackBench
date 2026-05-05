import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapeResult, ScrapedProduct } from '../types';
import logger from '../lib/logger';

const PROXIES = (process.env.PROXY_LIST || '').split(',').filter(Boolean);
let proxyIndex = 0;

function getNextProxy(): string | undefined {
  if (!PROXIES.length) return undefined;
  const proxy = PROXIES[proxyIndex % PROXIES.length];
  proxyIndex++;
  return proxy;
}

async function fetchHtml(url: string, retries = 3): Promise<string> {
  const proxy = getNextProxy();
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0 Safari/537.36',
    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: 'https://www.google.com',
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const config: Parameters<typeof axios.get>[1] = {
        headers,
        timeout: 15000,
        ...(proxy && { proxy: { host: proxy.split(':')[0], port: parseInt(proxy.split(':')[1]) } }),
      };
      const { data } = await axios.get(url, config);
      return data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      logger.warn(`Scrape attempt ${attempt}/${retries} failed for ${url}: HTTP ${status}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw new Error('All retry attempts failed');
}

function scrapeAmazon($: cheerio.CheerioAPI): Partial<ScrapedProduct> {
  const name = $('#productTitle').text().trim();
  const priceWhole = $('.a-price-whole').first().text().replace(/[^0-9]/g, '');
  const priceFraction = $('.a-price-fraction').first().text().replace(/[^0-9]/g, '');
  const price = priceWhole ? parseFloat(`${priceWhole}.${priceFraction || '00'}`) : null;

  const ratingText = $('.a-icon-star-small .a-icon-alt, #averageCustomerReviews .a-icon-alt').first().text();
  const rating = ratingText ? parseFloat(ratingText) : null;
  const reviewText = $('#acrCustomerReviewText').first().text().replace(/[^0-9]/g, '');
  const reviewCount = reviewText ? parseInt(reviewText) : null;

  const imageUrl =
    $('#landingImage').attr('src') ||
    $('#imgTagWrapperId img').attr('src') ||
    null;

  const asinMatch = $('input[name="ASIN"]').val() as string;
  const sku = asinMatch || null;

  const currency = $('.a-price-symbol').first().text().trim() === '$' ? 'USD' : 'USD';

  return { name, price, currency, imageUrl, rating, reviewCount, sku, description: null };
}

function scrapeMercadoLibre($: cheerio.CheerioAPI): Partial<ScrapedProduct> {
  const name = $('.ui-pdp-title, h1.item-title__primary').first().text().trim();

  const fraction = $('.price-tag-fraction, .andes-money-amount__fraction').first().text().replace(/[^0-9]/g, '');
  const cents = $('.price-tag-cents, .andes-money-amount__cents').first().text().replace(/[^0-9]/g, '');
  const price = fraction ? parseFloat(`${fraction}.${cents || '00'}`) : null;

  const ratingText = $('.ui-pdp-review__rating').first().text().trim();
  const rating = ratingText ? parseFloat(ratingText) : null;

  const reviewText = $('.ui-pdp-review__amount').first().text().replace(/[^0-9]/g, '');
  const reviewCount = reviewText ? parseInt(reviewText) : null;

  const imageUrl = $('.ui-pdp-gallery__figure img, img.gallery-image-container').first().attr('src') || null;

  const urlMatch = $('link[rel="canonical"]').attr('href') || '';
  const idMatch = urlMatch.match(/MLM?\d+/i);
  const sku = idMatch ? idMatch[0] : null;

  const currency = $('.price-tag-symbol').first().text().trim() || 'ARS';

  return { name, price, currency, imageUrl, rating, reviewCount, sku, description: null };
}

function scrapeShopify($: cheerio.CheerioAPI): Partial<ScrapedProduct> {
  const name =
    $('h1.product-single__title, h1.product__title, h1[itemprop="name"]').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') || '';

  const priceText =
    $('[class*="price"]:not([class*="compare"]):not([class*="was"])').first().text().replace(/[^0-9.,]/g, '') || '';
  const price = priceText ? parseFloat(priceText.replace(',', '')) : null;

  const imageUrl =
    $('meta[property="og:image"]').attr('content') ||
    $('img.product-featured-image, img[class*="product"]').first().attr('src') ||
    null;

  const description = $('meta[name="description"]').attr('content') || null;

  return { name, price, currency: 'USD', imageUrl, rating: null, reviewCount: null, sku: null, description };
}

export async function scrapeProduct(url: string): Promise<ScrapeResult> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    let data: Partial<ScrapedProduct>;

    if (url.includes('amazon')) {
      data = scrapeAmazon($);
    } else if (url.includes('mercadolibre') || url.includes('articulo.mercado')) {
      data = scrapeMercadoLibre($);
    } else {
      data = scrapeShopify($);
    }

    if (!data.name) return { success: false, error: 'Could not extract product name' };

    return {
      success: true,
      data: {
        name: data.name,
        price: data.price ?? null,
        currency: data.currency || 'USD',
        imageUrl: data.imageUrl ?? null,
        rating: data.rating ?? null,
        reviewCount: data.reviewCount ?? null,
        sku: data.sku ?? null,
        description: data.description ?? null,
        isAvailable: true,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown scrape error';
    logger.error('Scrape failed', { url, error: message });
    return { success: false, error: message };
  }
}
