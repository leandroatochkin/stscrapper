import { Page } from "playwright";
import { parseHtml, ScrapeConfig } from "../utils/htmlParser";

const BASE_URL = "https://diaonline.supermercadosdia.com.ar";

  const diaConfig: ScrapeConfig = {
    container: ".vtex-product-summary-2-x-container",
    name: ".vtex-product-summary-2-x-brandName, .vtex-product-summary-2-x-nameContainer",
    link: "a.vtex-product-summary-2-x-clearLink",
    price: {
      // DIA often puts the price in classes containing 'sellingPriceValue'
      wrapper: "[class*='sellingPriceValue'], .vtex-product-summary-2-x-price_sellingPrice, .vtex-product-price-1-x-currencyContainer",
    },
    // DIA highlights promos in high-contrast badges
    promo: ".vtex-product-highlights-2-x-productHighlightText, .vtex-product-price-1-x-savingsPercentage",
    baseUrl: BASE_URL
  };

export async function scrapeDia(page: Page, query: string) {
  // Direct search URL (VTEX standard)
  const url = `${BASE_URL}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;

  try {
    console.log(`[DIA] Navigating to: ${url}`);

    // 1. Navigate - 'networkidle' is better for VTEX to ensure price APIs finish
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

    // 2. Wait for the products
    await page.waitForSelector(diaConfig.container, { timeout: 20000 }).catch(() => {
        console.warn("[DIA] No products rendered for this query.");
    });

    // 3. Scroll to trigger hydration (DIA is aggressive with lazy loading)
    //await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);

    const html = await page.content();
    
    // This handles: normalizeSpanish, extractBrand (CSV), and price math (*100)
    const products = parseHtml(html, diaConfig, "DIA");

    console.log(`[DIA] Found ${products.length} products`);
    return products;

  } catch (error) {
    console.error(`[SCRAPE ERROR - DIA]:`, error);
    return [];
  }
}