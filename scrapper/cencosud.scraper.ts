import { Page } from 'playwright';
import { parseHtml, ScrapeConfig } from "../utils/htmlParser";
import * as cheerio from 'cheerio';
import { parsePrice } from '../utils/helpers';

const DOMAINS: Record<string, string> = {
  JUMBO: "https://www.jumbo.com.ar",
  DISCO: "https://www.disco.com.ar",
  VEA: "https://www.vea.com.ar",
};

export async function scrapeCencosud(page: Page, store: string, query: string) {
  const storeKey = store.toUpperCase();
  const baseUrl = DOMAINS[storeKey];
  if (!baseUrl) return [];

  const url = `${baseUrl}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;

  const cencosudConfig: ScrapeConfig = {
    container: ".vtex-product-summary-2-x-container",
    name: ".vtex-product-summary-2-x-brandName",
    link: "a.vtex-product-summary-2-x-clearLink",
    price: {
      // Restored your working greedy selectors
      wrapper: ".vtex-price-format-gallery, [class*='sellingPriceValue'], #priceContainer",
    },
    promo: ".containerProductHighlight, .vtex-product-highlights-2-x-productHighlightText",
    baseUrl: baseUrl,
    sku: ''
  };

  try {
    
    // 1. Navigation with commit to avoid "waiting for networkidle" timeouts on heavy Vtex sites
    await page.goto(url, { waitUntil: "commit", timeout: 60000 });

    // 2. Wait for the product shelf to appear (prevents empty results)
    try {
      await page.waitForSelector('.vtex-product-summary-2-x-container', { timeout: 15000 });
    } catch (e) {
      console.warn(`[${storeKey}] Product grid not found. Checking for location modal bypass...`);
      // Attempt to clear any overlay blocking the content
      const closeBtn = await page.$('.vtex-address-locator-1-x-closeButton, .vtex-modal__close-icon');
      if (closeBtn) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // 3. Scroll to trigger hydration of prices and images
    //await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(2500);

    const html = await page.content();
    const $ = cheerio.load(html);

    // 4. Extract SKUs and Metadata from JSON-LD (Following Carrefour example)
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

    const products = parseHtml(html, cencosudConfig, storeKey);

    // 5. Enrich data following the Carrefour Pattern
    return products.map(p => {
      const path = new URL(p.link, baseUrl).pathname;
      const extra = skuMap[path];

      // Scoped container for specific price/promo extraction
      const productContainer = $(`.vtex-product-summary-2-x-container:has(a[href*="${path}"])`);
      
      const href = productContainer.closest('a').attr('href') || 
                   productContainer.find('a').attr('href') || 
                   productContainer.parent('a').attr('href') || "";

      // Target specific price elements found in your HTML snippet
      const sellingPriceText = productContainer.find('#priceContainer').text() || 
                               productContainer.find("[class*='sellingPriceValue']").first().text();
      
      const listPriceText = productContainer.find("[class*='listPriceValue']").first().text() || 
                            productContainer.find("[class*='store-theme-2t-mVsKNpKjmCAEM_AMCQH']").first().text();

      const discountBadge = productContainer.find("[class*='store-theme-SpFtPOZlANEkxX04GqL31']").text() || 
                            productContainer.find("[title*='OFERTA']").text();

      const htmlSellingPrice = parsePrice(sellingPriceText);
      const htmlOriginalPrice = parsePrice(listPriceText);

      // Priority: 1. HTML parsed price, 2. JSON-LD price, 3. parseHtml result
      const finalPrice = htmlSellingPrice || extra?.price || p.price;
      const finalOriginalPrice = htmlOriginalPrice || extra?.originalPrice || finalPrice;

      return {
        ...p,
        sku: extra?.sku || path.split('-').pop()?.replace('/', '') || p.sku,
        price: finalPrice,
        originalPrice: finalOriginalPrice,
        promoText: (discountBadge + " " + (productContainer.find(cencosudConfig.promo).text().trim() || p.promoText)).trim(),
        // Matching Carrefour brand extraction (Placeholder)
        // Factory level extractBrand() will handle the CSV mapping later
        brand: p.name.split(' ')[0],
        url: `${baseUrl}${href}`
      };
    });

  } catch (error) {
    console.error(`[SCRAPE ERROR - ${storeKey}]:`, error);
    return [];
  }
}
