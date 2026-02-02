import { Page } from "playwright";

const BASE_URL = "https://www.toledodigital.com.ar";

export async function scrapeToledo(page: Page, query: string) {
  try {
    console.log(`[Toledo] Searching for: ${query}`);

    // 1. Navigate directly to search results (VTEX standard)
    const searchUrl = `${BASE_URL}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;
    
    await page.goto(searchUrl, {
        waitUntil: "domcontentloaded", // Switched from networkidle to be less strict
        timeout: 60000, // 60 seconds
        });

    // 2. Handle the "Confirmar Sucursal" popup if it appears
    // We do this quickly so it doesn't block the extraction
    try {
      const confirmBtn = page.locator('button:has-text("Confirmar")').first();
      if (await confirmBtn.isVisible({ timeout: 5000 })) {
        await confirmBtn.click();
      }
    } catch (e) {
      // Popup didn't show, which is fine
    }

    // 3. Wait for Results Gallery
    await page.waitForSelector(".vtex-search-result-3-x-galleryItem", { timeout: 20000 });

    // 4. Extraction Logic
    const products = await page.$$eval(
      ".vtex-search-result-3-x-galleryItem",
      (cards) => {
        return cards.slice(0, 10).map((card) => {
          // Name Logic
          const name = card.querySelector(".vtex-product-summary-2-x-brandName")?.textContent?.trim() || 
                       card.querySelector(".vtex-product-summary-2-x-nameContainer")?.textContent?.trim() || "";

          // Price Logic (Robust VTEX parsing)
          const priceWholeElem = card.querySelector(".vtex-product-price-1-x-currencyInteger");
          const priceFractionElem = card.querySelector(".vtex-product-price-1-x-currencyFraction");

          let price = 0;
          if (priceWholeElem) {
            const wholeStr = priceWholeElem.textContent?.replace(/\D/g, "") || "0";
            const fractionStr = priceFractionElem?.textContent?.replace(/\D/g, "") || "00";
            price = parseInt(wholeStr, 10) + (parseInt(fractionStr, 10) / 100);
          } else {
            const fallbackPrice = card.querySelector('[class*="Price"], [class*="sellingPrice"]')?.textContent;
            if (fallbackPrice) {
               const cleaned = fallbackPrice.replace(/\./g, "").replace(",", ".");
               price = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
            }
          }

          // Promo Text
          const promoText = card.querySelector(".vtex-product-highlights-2-x-productHighlightText")?.textContent?.trim() ||
                            card.querySelector(".vtex-product-price-1-x-savingsPercentage")?.textContent?.trim() || null;

          // URL Logic
          const linkAttr = card.querySelector("a")?.getAttribute("href") || "";
          const link = linkAttr.startsWith("http") ? linkAttr : `https://www.toledodigital.com.ar${linkAttr}`;

          return {
            name,
            price: Math.round(price),
            link,
            promoText
          };
        });
      }
    );

    console.log(`[Toledo] Found ${products.length} products`);
    return products;

  } catch (error) {
    console.error("[Toledo Scraper] Error:", error);
    return [];
  }
}