import { Page } from "playwright";

const SEARCH_BASE_URL = "https://www.cotodigital.com.ar/sitios/cdigi/browse?_dyncharset=utf-8&Ntt=";

export async function scrapeCoto(page: Page, query: string) {
  try {
    console.log(`[Coto] Searching for: ${query}`);
    
    // 1. Navigate directly to search results
    // Coto uses Ntt parameter for search terms
    const searchUrl = `${SEARCH_BASE_URL}${encodeURIComponent(query)}`;
    
    await page.goto(searchUrl, { 
      waitUntil: "networkidle", 
      timeout: 60000 
    });

    // 2. Wait for the product grid to render
    // '.product_grid' or '.card-container' are the usual targets
    await page.waitForSelector('.card-container', { timeout: 20000 });

    // 3. Extract data
    const products = await page.$$eval('.card-container', (cards) => {
      return cards.slice(0, 10).map(card => {
        // Name extraction
        const nameEl = card.querySelector('.nombre-producto');
        const name = nameEl?.textContent?.trim() || "";
        
        // Price extraction
        // Coto often has "price_discount" and "price_regular", 
        // .atg_store_newPrice or .atg_store_price are common classes
        const priceEl = card.querySelector('.atg_store_newPrice') || card.querySelector('.price_discount') || card.querySelector('.card-title');
        const priceText = priceEl?.textContent?.trim() || "0";
        
        // Clean price: $ 1.250,50 -> 1250.50
        const price = Number(
          priceText
            .replace(/\$/g, "")
            .replace(/\./g, "")
            .replace(/,/g, ".")
            .replace(/[^0-9.]/g, "")
        );
        
        // Link extraction
        // Sometimes the link is an <a> wrapping the card, sometimes a title link
        const linkEl = card.querySelector('a') || card.closest('a');
        const link = linkEl?.getAttribute('href') || "";
        const fullLink = link.startsWith('http') 
          ? link 
          : `https://www.cotodigital.com.ar${link}`;
        
        // Promo extraction
        const promoEl = card.querySelector('.cucarda-promo') || card.querySelector('.oferta_polenta');
        const promoText = promoEl?.textContent?.trim() || null;
        
        return { name, price, link: fullLink, promoText };
      });
    });

    console.log(`[Coto] Found ${products.length} products`);
    return products;

  } catch (err) {
    console.error("[Coto Scraper Error]:", err);
    // Note: We don't close the browser here; the Factory handles the context/page cleanup
    return [];
  }
}