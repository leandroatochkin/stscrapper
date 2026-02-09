import { getPageHtml } from '../services/scraperEngine.service';
import { parseHtml, ScrapeConfig } from '../utils/htmlParser';
import * as cheerio from 'cheerio';

export async function scrapeCarrefour(query: any) {
  const searchString = typeof query === 'object' ? query.query : query;
  const url = `https://www.carrefour.com.ar/${encodeURIComponent(searchString)}?_q=${encodeURIComponent(searchString)}&map=ft`;

  const carrefourConfig: ScrapeConfig = {
    container: '.vtex-product-summary-2-x-container',
    name: '.vtex-product-summary-2-x-brandName',
    link: 'a.vtex-product-summary-2-x-clearLink',
    price: { wrapper: '.valtech-carrefourar-product-price-0-x-sellingPriceValue' },
    promo: 'span[data-specification-group="Ribbons"]',
    baseUrl: 'https://www.carrefour.com.ar',
    sku: '' 
  };

  try {
    const html = await getPageHtml(url);
    if (!html) return [];
    const $ = cheerio.load(html);
    
    const skuMap: Record<string, any> = {};
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = json.itemListElement || [];
        items.forEach((entry: any) => {
          const p = entry.item;
          if (p && p['@id']) {
            const path = new URL(p['@id'], 'https://www.carrefour.com.ar').pathname;
            skuMap[path] = {
              sku: p.sku,
              // We'll keep these as backups, but prioritize HTML
              price: p.offers?.lowPrice,
              originalPrice: p.offers?.highPrice
            };
          }
        });
      } catch (e) {}
    });

    const products = parseHtml(html, carrefourConfig, "CARREFOUR");

    return products.map(p => {
      const path = new URL(p.link, 'https://www.carrefour.com.ar').pathname;
      const extra = skuMap[path];

      // --- NEW FIX: Extract crossed-out price from HTML ---
      // We look for the container that matches this specific product link
      const productContainer = $(`.vtex-product-summary-2-x-container:has(a[href*="${path}"])`);

      const href = productContainer.closest('a').attr('href') || 
                   productContainer.find('a').attr('href') || 
                   productContainer.parent('a').attr('href') || "";
      
      const listPriceText = productContainer.find('.valtech-carrefourar-product-price-0-x-listPriceValue').text();
      const htmlOriginalPrice = parseCarrefourPrice(listPriceText);
      const htmlSellingPrice = parseCarrefourPrice(productContainer.find('.valtech-carrefourar-product-price-0-x-sellingPriceValue').text());

      // Priority: 1. HTML parsed price, 2. JSON-LD price, 3. parseHtml result
      const finalPrice = htmlSellingPrice || extra?.price || p.price;
      const finalOriginalPrice = htmlOriginalPrice || extra?.originalPrice || finalPrice;

      return {
        ...p,
        sku: extra?.sku || path.split('-').pop()?.replace('/', '') || p.sku,
        price: finalPrice,
        originalPrice: finalOriginalPrice,
        // Get the promo highlight if it exists (e.g., "4x3 Combinable")
        promoText: productContainer.find('.valtech-carrefourar-product-highlights-0-x-productHighlightText').text().trim() || p.promoText,
        brand: p.name.split(' ')[0],
        url: `${carrefourConfig.baseUrl}${href}`
      };
    });

  } catch (error) {
    console.error("[Carrefour Error]:", error);
    return [];
  }
}

// Helper to handle Argentine currency format ($ 1.234,56)
function parseCarrefourPrice(text: string): number {
  if (!text) return 0;
  const cleaned = text.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  return parseFloat(cleaned) || 0;
}