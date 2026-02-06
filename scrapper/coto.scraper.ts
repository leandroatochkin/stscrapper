import { Page } from "playwright";
import { parseHtml, ScrapeConfig } from "../utils/htmlParser";

const SEARCH_BASE_URL = "https://www.cotodigital.com.ar/sitios/cdigi/browse?_dyncharset=utf-8&Ntt=";

const cotoConfig: ScrapeConfig = {
  // Target the Angular component wrapper
  container: "catalogue-product", 
  // The name is inside the h3 or the data attribute
  name: ".nombre-producto",
  link: "a:first-child",
  price: {
    // The h4.card-title contains the final price "$1.580,00"
    wrapper: "h4.card-title", 
  },
  // The promo text like "NO ACUMULABLE..." or "OFERTA"
  promo: ".cucarda-promo, .offer-crum",
  baseUrl: "https://www.cotodigital.com.ar"
};

export async function scrapeCoto(page: Page, query: string) {
  const url = `${SEARCH_BASE_URL}${encodeURIComponent(query)}`;

  try {
    console.log(`[Coto] Navigating to: ${url}`);
    
    // 1. Angular requires waiting for the network to settle
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // 2. Wait specifically for the Angular product tags
    await page.waitForSelector('catalogue-product', { timeout: 20000 }).catch(() => {
        console.warn("[Coto] No catalogue-product elements appeared.");
    });

    // 3. Optional: Scroll to ensure images/prices hydrate
    //await page.evaluate(() => window.scrollBy(0, 500));

    const html = await page.content();
    
    // parseHtml handles the brand extraction from your CSV and price cleaning
    const products = parseHtml(html, cotoConfig, "COTO");

    console.log(`[Coto] Found ${products.length} items`);
    return products;

  } catch (err) {
    console.error("[Coto Scraper Error]:", err);
    return [];
  }
}