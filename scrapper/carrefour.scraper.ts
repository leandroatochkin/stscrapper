import { Page } from "playwright";


const BASE_URL = "https://www.carrefour.com.ar";

export async function scrapeCarrefour(page: Page, query: string) {
  try {
    console.log(`[Carrefour] Searching for: ${query}`);

    // 1. Navigate to the search results page
    // Carrefour uses /query-term?_q=query-term
    const searchUrl = `${BASE_URL}/${encodeURIComponent(query)}?_q=${encodeURIComponent(query)}`;

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // 2. Wait for the product shelf to appear
    // This class is common in VTEX stores (like Carrefour)
    await page.waitForSelector('.vtex-product-summary-2-x-container', { timeout: 30000 });

    // 3. Extract data
    // 3. Extract data
    const products = await page.$$eval('.vtex-product-summary-2-x-container', (cards) => {
    return cards.slice(0, 10).map(card => {
        // Name: Using the class you provided for the full product string
        const nameEl = card.querySelector('.vtex-product-summary-2-x-brandName');
        const name = nameEl?.textContent?.trim() || "";
        
        // Price: Targeting the selling price value
        const priceEl = card.querySelector('.valtech-carrefourar-product-price-0-x-sellingPriceValue');
        const priceText = priceEl?.textContent?.trim() || "0";
        
        const price = Number(
        priceText
            .replace(/\$/g, "")
            .replace(/\./g, "")
            .replace(/,/g, ".")
            .replace(/[^0-9.]/g, "")
        );
        
        // Link
        const linkEl = card.querySelector('a');
        const link = linkEl?.getAttribute('href') || "";
        const fullLink = link.startsWith('http') ? link : `https://www.carrefour.com.ar${link}`;
        
        // Promo: Targeting the specific "Ribbons" specification you provided
        // We look for any span that has the data-specification-group="Ribbons"
        const promoEl = card.querySelector('span[data-specification-group="Ribbons"]');
        const promoText = promoEl?.textContent?.trim() || null;
        
        return { name, price, link: fullLink, promoText };
    });
    });

    console.log(`[Carrefour] Found ${products.length} products`);
    return products;

  } catch (err) {
    console.error("[Carrefour Scraper Error]:", err);
    return [];
  }
}