import { Page } from "playwright";
import { parseHtml, ScrapeConfig } from "../utils/htmlParser";

const BASE_URL = "https://www.toledodigital.com.ar";

const toledoConfig: ScrapeConfig = {
  container: "article.vtex-product-summary-2-x-element",
  name: ".vtex-product-summary-2-x-brandName",
  link: "a.vtex-product-summary-2-x-clearLink",
  price: {
    wrapper: ".vtex-product-summary-2-x-price_sellingPrice",
    integer: ".vtex-product-summary-2-x-currencyInteger",
    fraction: ".vtex-product-price-1-x-currencyFraction"
  },
  // Added Toledo-specific cucarda classes
  promo: ".toledodigitalar-theme-0-x-cucarda2x1Text, .toledodigitalar-theme-0-x-cucardaDescuentoSegundaUnidadText, .vtex-product-highlights-2-x-productHighlightText",
  baseUrl: "https://www.toledodigital.com.ar"
};

export async function scrapeToledo(page: Page, query: string) {
  const url = `${BASE_URL}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;



  try {
    console.log(`[Toledo] Navigating to: ${url}`);

    // 1. Use 'load' instead of 'networkidle' to avoid hanging on trackers
    await page.goto(url, { waitUntil: "load", timeout: 45000 });

    // 2. Immediate Modal Check
    // We try to clear this as fast as possible
    const modalButton = page.locator('button:has-text("Confirmar"), .vtex-address-locator-1-x-closeButton').first();
    try {
        if (await modalButton.isVisible({ timeout: 3000 })) {
            await modalButton.click();
        }
    } catch (e) { /* ignore if not visible */ }

    // 3. Wait for the actual product content instead of the whole network
    await page.waitForSelector(toledoConfig.container, { timeout: 15000 });

    // 4. Force a scroll to trigger lazy-loaded prices
    //await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(2000); // Give VTEX a moment to hydrate

    const html = await page.content();
    
    // Standardized parser handles the CSV Brand mapping and Price * 100 logic
    const products = parseHtml(html, toledoConfig, "TOLEDO");

    console.log(`[Toledo] Found ${products.length} products`);
    return products;

  } catch (error) {
    console.error("[Toledo Scraper Error]:", error);
    return [];
  }
}