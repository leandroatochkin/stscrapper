import { Page } from 'playwright';
import { parseHtml, ScrapeConfig } from "../utils/htmlParser";

const DOMAINS: Record<string, string> = {
  JUMBO: "https://www.jumbo.com.ar",
  DISCO: "https://www.disco.com.ar",
  VEA: "https://www.vea.com.ar",
};

export async function scrapeCencosud(page: Page, store: string, query: string) {
  const storeKey = store.toUpperCase();
  const baseUrl = DOMAINS[storeKey];
  const url = `${baseUrl}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;

  const cencosudConfig: ScrapeConfig = {
  container: ".vtex-product-summary-2-x-container",
  name: ".vtex-product-summary-2-x-brandName", 
  link: "a.vtex-product-summary-2-x-clearLink",
  price: {
    // Greedy selector: 
    // 1. Look for the common format gallery class
    // 2. Look for any class ending in sellingPriceValue
    // 3. Fallback to the ID
    wrapper: ".vtex-price-format-gallery, [class*='sellingPriceValue'], #priceContainer", 
  },
  // Jumbo's promo logic is often in 'containerProductHighlight' or 'flagsContainer'
  promo: ".containerProductHighlight, .vtex-product-highlights-2-x-productHighlightText",
  baseUrl: baseUrl
};

  try {
  console.log(`[${storeKey}] Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  // 1. Check for the "Confirmar Sucursal" popup (Common in Jumbo)
  // We look for the "Comprar" button or the "X" to close the location modal
  const popupSelector = 'button:has-text("Comprar"), .vtex-address-locator-1-x-closeButton';
  const popup = await page.$(popupSelector);
  
  if (popup) {
    console.log(`[${storeKey}] Location popup detected. Attempting to bypass...`);
    await popup.click();
    await page.waitForTimeout(2000); // Wait for overlay to disappear
  }

  // 2. SCROLL to trigger hydration
  // Jumbo won't load prices if it doesn't think a human is looking
  //await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(2000);

  // 3. Greedier Selector Check
  // Sometimes Jumbo uses a different class for the price wrapper
  await page.waitForSelector('.vtex-product-summary-2-x-brandName, #priceContainer', { timeout: 15000 });

  const html = await page.content();
  const products = parseHtml(html, cencosudConfig, storeKey);

  console.log(`[${storeKey}] Found ${products.length} products`);
  return products;
} catch (error) {
    console.error(`[SCRAPE ERROR - ${storeKey}]:`, error);
    return [];
  }
}