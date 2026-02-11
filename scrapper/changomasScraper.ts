import { Page } from 'playwright';
import { parseHtml, ScrapeConfig } from '../utils/htmlParser';
import * as cheerio from 'cheerio';

export async function scrapeChangoMas(page: Page, query: string) {
  const baseUrl = 'https://www.masonline.com.ar';
  const url = `${baseUrl}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;
  
  const changoConfig: ScrapeConfig = {
    container: '.vtex-product-summary-2-x-container',
    name: '.vtex-product-summary-2-x-brandName',
    link: 'a.vtex-product-summary-2-x-clearLink',
    price: {
      wrapper: '.valtech-gdn-dynamic-product-1-x-dynamicProductPrice',
      integer: '.valtech-gdn-dynamic-product-1-x-currencyInteger',
      fraction: '.valtech-gdn-dynamic-product-1-x-currencyFraction'
    },
    promo: '.valtech-gdn-dynamic-product-1-x-weighableSavingsPercentage',
    baseUrl: baseUrl,
    sku: ''
  };

  try {
    
    // 1. Navigate and wait for content (VTEX sites need this)
    await page.goto(url, { waitUntil: "commit", timeout: 60000 });

    // 2. Wait for the products to actually render
    try {
        await page.waitForSelector('.vtex-product-summary-2-x-container', { timeout: 15000 });
    } catch (e) {
        console.warn("[ChangoMas] Timeout waiting for products. Site might be slow or empty.");
    }

    // 3. Scroll to hydrate prices/SKUs
    //await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(2000);

    const html = await page.content();
    const $ = cheerio.load(html);

    // 4. Extract SKUs and Metadata from JSON-LD (Standard Carrefour/Cencosud Pattern)
    const skuMap: Record<string, any> = {};
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = json.itemListElement || [];
        items.forEach((entry: any) => {
          const p = entry.item;
          if (p && p['@id']) {
            const path = new URL(p['@id'], baseUrl).pathname;
            skuMap[path] = {
              sku: p.sku,
              price: p.offers?.lowPrice,
              originalPrice: p.offers?.highPrice
            };
          }
        });
      } catch (e) {}
    });

    const products = parseHtml(html, changoConfig, "CHANGOMAS");

    // 5. Map results following the standardized pattern
    return products.map(p => {
      const path = new URL(p.link, baseUrl).pathname;
      const extra = skuMap[path];

      // Scoped container for specific price parsing
      const productContainer = $(`.vtex-product-summary-2-x-container:has(a[href*="${path}"])`);

      const href = productContainer.closest('a').attr('href') || 
                   productContainer.find('a').attr('href') || 
                   productContainer.parent('a').attr('href') || "";

      // ChangoMas specific: List Price often uses 'listPriceValue' or similar VTEX classes
      const listPriceText = productContainer.find("[class*='listPriceValue']").first().text();
      const sellingPriceText = productContainer.find(changoConfig.price.wrapper as string).first().text();

      const htmlSellingPrice = parseChangoPrice(sellingPriceText);
      const htmlOriginalPrice = parseChangoPrice(listPriceText);

      // Priority: 1. HTML parsed, 2. JSON-LD, 3. parseHtml fallback
      const finalPrice = htmlSellingPrice || extra?.price || p.price;
      const finalOriginalPrice = htmlOriginalPrice || extra?.originalPrice || finalPrice;

      return {
        ...p,
        sku: extra?.sku || path.split('-').pop()?.replace('/', '') || p.sku,
        price: finalPrice,
        originalPrice: finalOriginalPrice,
        promoText: productContainer.find(changoConfig.promo as string).text().trim() || p.promoText,
        // Match Carrefour's placeholder brand extraction
        brand: p.name.split(' ')[0],
        url: `${baseUrl}${href}`
      };
    });

  } catch (error) {
    console.error("[ChangoMas Scraper Error]:", error);
    return [];
  }
}

/**
 * Standardized Argentine currency parser
 */
function parseChangoPrice(text: string): number {
  if (!text) return 0;
  const cleaned = text.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  return parseFloat(cleaned) || 0;
}