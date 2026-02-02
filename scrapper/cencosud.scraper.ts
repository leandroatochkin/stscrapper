import { Page } from "playwright";

const DOMAINS: Record<string, string> = {
  JUMBO: "https://www.jumbo.com.ar",
  DISCO: "https://www.disco.com.ar",
  VEA: "https://www.vea.com.ar",
};

export async function scrapeCencosud(page: Page, store: string, query: string) {
  const baseUrl = DOMAINS[store.toUpperCase()];
  if (!baseUrl) throw new Error(`Invalid store: ${store}`);

  try {
    const searchUrl = `${baseUrl}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}&map=ft`;
    
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForSelector(".vtex-product-summary-2-x-container", { timeout: 15000 });

    const products = await page.$$eval(
      ".vtex-product-summary-2-x-container",
      (cards, domain) => {
        return cards.slice(0, 10).map(card => {
          // 1. Name extraction
          const name = card.querySelector(".vtex-product-summary-2-x-productNameContainer")?.textContent?.trim() || 
                       card.querySelector(".vtex-product-summary-2-x-brandName")?.textContent?.trim() || 
                       card.querySelector('[class*="productName"]')?.textContent?.trim() || "";

          // 2. UNIVERSAL PRICE LOGIC
          // We target the ID #priceContainer which you found in Disco/Vea
          const priceEl = card.querySelector("#priceContainer") || 
                          card.querySelector('[class*="-price-format"]') ||
                          card.querySelector('[class*="currencyContainer"]');
          
          const priceRaw = priceEl?.textContent || "0";
          
          // Robust Cleaning for Argentina format ($1.733,33 or $1.690)
          const cleanedPrice = priceRaw
            .replace(/\./g, "")      // Remove thousands dot
            .replace(",", ".")       // Convert decimal comma to dot
            .replace(/[^0-9.]/g, ""); // Strip currency symbols/spaces
          
          const price = Math.round(parseFloat(cleanedPrice) || 0);

          // 3. Link Logic
          const relativeLink = card.querySelector("a")?.getAttribute("href") || "";
          const link = relativeLink.startsWith("http") ? relativeLink : `${domain}${relativeLink}`;

          // 4. UNIVERSAL PROMO LOGIC
          // Target the specific spans you identified by checking for the 'store-theme' class pattern
          const promoEl = card.querySelector('span[class*="store-theme-"]') || 
                          card.querySelector(".vtex-product-highlights-2-x-productHighlightText") ||
                          card.querySelector('[class*="badge"]');
          
          const promoText = promoEl?.textContent?.trim() || null;

          return { name, price, link, promoText };
        });
      },
      baseUrl
    );

    return products;
  } catch (error) {
    console.error(`[SCRAPE ERROR - ${store}]:`, error);
    return [];
  }
}