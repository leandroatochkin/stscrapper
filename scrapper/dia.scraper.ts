import { Page } from "playwright";

const BASE_URL = "https://diaonline.supermercadosdia.com.ar";

export async function scrapeDia(page: Page, query: string) {
  try {
    // 1. Navigate directly to the search results page (Faster & more reliable)
    const searchUrl = `${BASE_URL}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;
    
    await page.goto(searchUrl, {
      waitUntil: "networkidle", // Wait for the page to be quiet
      timeout: 45000,
    });

    // 2. Wait for the products to actually render
    // VTEX stores often show the shell first, so we wait for the actual container
    await page.waitForSelector(".vtex-product-summary-2-x-container", { 
      timeout: 20000 
    });

    // 3. Extract data
    const products = await page.$$eval(
      ".vtex-product-summary-2-x-container",
      (cards) => {
        return cards.slice(0, 5).map(card => {
          // Promo Logic
          const promoText = 
            card.querySelector('.vtex-product-highlights-2-x-productHighlightText')?.textContent?.trim() ||
            card.querySelector('.vtex-product-price-1-x-savingsPercentage')?.textContent?.trim() ||
            card.querySelector('.vtex-product-highlights-2-x-productHighlightText--promotions')?.textContent?.trim() ||
            null;

          // Name Logic
          const name = card.querySelector(".vtex-product-summary-2-x-productNameContainer")?.textContent?.trim() ?? "";

          // Price Logic
          const priceElement = card.querySelector('[class*="sellingPrice"]') || card.querySelector('[class*="price"]');
          const priceText = priceElement?.textContent || "0";
          const price = Number(priceText.replace(/\./g, "").replace(/[^0-9]/g, ""));

          // Link Logic
          const relativeLink = card.querySelector("a")?.getAttribute("href") ?? "";
          const link = relativeLink.startsWith("http")
            ? relativeLink
            : `https://diaonline.supermercadosdia.com.ar${relativeLink}`;

          return { name, price, link, promoText };
        });
      }
    );

    return products;

  } catch (error) {
    console.error(`[SCRAPE ERROR - DIA]:`, error);
    return []; // Return empty array so the whole search doesn't fail
  }
}