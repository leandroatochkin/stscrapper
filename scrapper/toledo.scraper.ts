import { Page } from "playwright";
import * as cheerio from 'cheerio';
import { parseHtml, ScrapeConfig } from "../utils/htmlParser";

const BASE_URL = "https://www.toledodigital.com.ar";

const toledoConfig: ScrapeConfig = {
  container: "article.vtex-product-summary-2-x-element",
  name: ".vtex-product-summary-2-x-brandName, .vtex-product-summary-2-x-nameContainer",
  link: "a.vtex-product-summary-2-x-clearLink",
  price: {
    wrapper: ".vtex-product-summary-2-x-price_sellingPrice",
  },
  promo: ".toledodigitalar-theme-0-x-cucarda2x1Text, .toledodigitalar-theme-0-x-cucardaDescuentoSegundaUnidadText, .vtex-product-highlights-2-x-productHighlightText",
  baseUrl: BASE_URL,
  sku: ''
};

export async function scrapeToledo(page: Page, query: string) {
  const url = `${BASE_URL}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;

  try {
 
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // 1. Handle Location Modal
    const modalButton = page.locator('button:has-text("Confirmar"), .vtex-address-locator-1-x-closeButton').first();
    await modalButton.click({ timeout: 5000 }).catch(() => {});

    // 2. Wait for the grid
    await page.waitForSelector("article.vtex-product-summary-2-x-element", { state: 'visible', timeout: 15000 });

    // 3. Scroll loop to hydrate all 28+ results
    for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(800);
    }

    const html = await page.content();
    const $ = cheerio.load(html);
    const results: any[] = [];

    // 4. Target the articles
    $("article.vtex-product-summary-2-x-element").each((_, el) => {
      const container = $(el);
      
      // FIX: Find the href in the parent <a> OR the child <a>
      // Toledo often does <a href="..."><article>...</article></a>
      const href = container.closest('a').attr('href') || 
                   container.find('a').attr('href') || 
                   container.parent('a').attr('href') || "";

      // SKU EXTRACTION from URL
      const skuMatch = href.match(/-(\d+)\/p/);
      const sku = skuMatch ? skuMatch[1] : "";

      const name = container.find(".vtex-product-summary-2-x-brandName, .vtex-product-summary-2-x-nameWrapper").first().text().trim();
      
      // PRICE: Full string from currency container
      const sellingPriceText = container.find(".vtex-product-summary-2-x-currencyContainer").first().text();
      const listPriceText = container.find("[class*='listPriceValue']").first().text();
      
      const price = parseToledoPrice(sellingPriceText);
      const originalPrice = parseToledoPrice(listPriceText);

      const promoText = container.find(toledoConfig.promo).first().text().trim();

      if (name && price > 0) {
        results.push({
          sku,
          name,
          price,
          originalPrice: originalPrice || price,
          promoText,
          url: `${BASE_URL}${href}`, // THIS SHOULD NO LONGER BE EMPTY
          brand: name.split(' ')[0]
        });
      }
    });


    return results;

  } catch (error) {
    console.error("[Toledo Scraper Error]:", error);
    return [];
  }
}

function parseToledoPrice(text: string): number {
  if (!text) return 0;
  // Cleans "$ 2.130,00" -> 2130
  const clean = text.replace(/[^\d,]/g, '').split(',')[0];
  return parseInt(clean) || 0;
}