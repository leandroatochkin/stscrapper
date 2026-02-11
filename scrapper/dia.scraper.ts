import { Page } from "playwright";
import * as cheerio from 'cheerio';
import { parseHtml, ScrapeConfig } from "../utils/htmlParser";
import { parsePrice } from "../utils/helpers";

const BASE_URL = "https://diaonline.supermercadosdia.com.ar";

const diaConfig: ScrapeConfig = {
  container: ".vtex-product-summary-2-x-container",
  name: ".vtex-product-summary-2-x-brandName, .vtex-product-summary-2-x-nameContainer",
  link: "a.vtex-product-summary-2-x-clearLink",
  price: {
    // UPDATED: Using the diaio-store classes from your snippet
    wrapper: ".diaio-store-5-x-sellingPriceValue, [class*='sellingPriceValue']",
  },
  // UPDATED: Added the specific savings percentage class found in your dump
  promo: ".vtex-product-price-1-x-savingsPercentage, .vtex-store-components-3-x-discountInsideContainer",
  baseUrl: BASE_URL,
  sku: ''
};

export async function scrapeDia(page: Page, query: string) {
  const url = `${BASE_URL}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Wait for the specific gallery item class from your snippet
    await page.waitForSelector(".diaio-search-result-0-x-galleryItem", { timeout: 15000 })
      .catch(() => console.log("Gallery items didn't appear, checking for single product..."));

    // Scroll to wake up lazy loading
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(2000);

    const html = await page.content();
    const $ = cheerio.load(html);
    
    // We target the gallery items specifically now
    const items = $(".diaio-search-result-0-x-galleryItem");
    const results: any[] = [];

    items.each((_, el) => {
      const container = $(el);
      const linkEl = container.find("a.vtex-product-summary-2-x-clearLink");
      const relativeLink = linkEl.attr("href") || "";
      
      // SKU EXTRACTION: Targeted at the number before /p
      // Example: /leche-semi-descremada-dia-larga-vida-1-lt-504/p -> 504
      const skuMatch = relativeLink.match(/-(\d+)\/p/);
      const sku = skuMatch ? skuMatch[1] : "";

      const name = container.find(".vtex-product-summary-2-x-brandName").text().trim();
      
      // PRICE EXTRACTION
      const sellingPriceText = container.find(".diaio-store-5-x-sellingPriceValue").first().text();
      const listPriceText = container.find(".diaio-store-5-x-listPriceValue").first().text();
      
      const price = parsePrice(sellingPriceText, undefined, false);
      const originalPrice = parsePrice(listPriceText, undefined, false);

      // PROMO EXTRACTION
      const promoText = container.find(".vtex-product-price-1-x-savingsPercentage, .vtex-store-components-3-x-discountInsideContainer").first().text().trim();

      if (name) {
        results.push({
          sku,
          name,
          price: price,
          originalPrice: originalPrice || price,
          promoText: promoText,
          url: `${BASE_URL}${relativeLink}`,
          brand: name.split(' ').includes("DIA") ? "DIA" : name.split(' ')[0]
        });
      }
    });

    return results;

  } catch (error) {
    console.error(`[SCRAPE ERROR - DIA]:`, error);
    return [];
  }
}

