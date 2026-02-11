import { Page } from "playwright";
import * as cheerio from 'cheerio';
import { parsePrice } from "../utils/helpers";

export async function scrapeCoto(page: Page, query: string) {
  const SEARCH_BASE_URL = "https://www.cotodigital.com.ar/sitios/cdigi/browse?_dyncharset=utf-8&Ntt=";
  const url = `${SEARCH_BASE_URL}${encodeURIComponent(query)}`;

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // Using Playwright's mouse to trigger hydration without needing 'window' in TS
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(2000);

    const html = await page.content();
    const $ = cheerio.load(html);
    const results: any[] = [];

    $(".card-container").each((_, el) => {
      const container = $(el);
      
      const name = container.find(".nombre-producto").text().trim();
      const link = container.find("a").attr("href") || "";

      // 1. PROMO TEXT (Handles the "25%DTO" or "PRECIO CON 25%DTO")
      let promoText = container.find(".offer-crum").text().trim();
      if (!promoText) {
        promoText = container.find(".cucarda-promo").text().trim();
      }

      // 2. SELLING PRICE ($1.871,25)
      const sellingPriceText = container.find("h4.card-title").text().trim();
      const price = parsePrice(sellingPriceText, undefined, false);

      // 3. ORIGINAL PRICE FIX (The "Precio Regular: $2.495,00")
      // We look for a <small> or element containing the text "Precio Regular"
      let originalPrice = 0;
      const regPriceElement = container.find("small, .card-text").filter((_, e) => {
        return $(e).text().toLowerCase().includes("precio regular");
      }).first();

      if (regPriceElement.length > 0) {
        originalPrice = parsePrice(regPriceElement.text(), undefined, false);
      }

      // 4. FALLBACKS
      // If no "Precio Regular" found, or if it's actually lower than sale price (parsing error)
      if (!originalPrice || originalPrice === 0 || originalPrice < price) {
        originalPrice = price;
      }

      if (name) {
        results.push({
          sku: container.attr("data-cnstrc-item-id") || "",
          name,
          price,
          originalPrice,
          promoText: promoText.replace(/\s+/g, ' ').trim(),
          url: link.startsWith("http") ? link : `https://www.cotodigital.com.ar${link}`,
          brand: name.split(' ').pop()
        });
      }
    });

    return results;

  } catch (err) {
    console.error("[Coto Scraper Error]:", err);
    return [];
  }
}

