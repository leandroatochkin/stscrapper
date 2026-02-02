import { Page } from "playwright";

const SEARCH_BASE_URL = "https://www.lacoopeencasa.coop/listado/busqueda-avanzada/";

export async function scrapeLaCoope(page: Page, query: string) {
  try {
    console.log(`[La Coope] Searching for: ${query}`);

    const searchUrl = `${SEARCH_BASE_URL}${encodeURIComponent(query)}`;
    
    // 1. Navigate
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    // 2. Wait for the actual card container from your HTML
    // We target the .tarjeta-articulo class which is clearly in your snippet
    await page.waitForSelector('.tarjeta-articulo', { timeout: 20000 });

    // 3. Extract data using the precise classes from your snippet
    const products = await page.$$eval('.tarjeta-articulo', (cards) => {
      return cards.slice(0, 10).map(card => {
        // Name: class="articulo-descripcion"
        const nameEl = card.querySelector('.articulo-descripcion');
        const name = nameEl?.textContent?.trim() || "";

        // Price: class="precio-entero" and "precio-decimal"
        // Note: The integer part often contains the "$" sign in a <small> tag
        const enteroEl = card.querySelector('.precio-entero');
        const decimalEl = card.querySelector('.precio-decimal');
        
        const enteroText = enteroEl?.textContent?.trim() || "0";
        const decimalText = decimalEl?.textContent?.trim() || "00";

        // Cleaning: remove dots (thousands) and extract numbers
        const cleanEntero = enteroText.replace(/\./g, "").replace(/[^0-9]/g, "");
        const cleanDecimal = decimalText.replace(/[^0-9]/g, "");
        const price = Number(`${cleanEntero}.${cleanDecimal}`);

        // Link: The <a> tag has the href
        const linkEl = card.querySelector('a[href*="/producto/"]');
        const href = linkEl?.getAttribute('href') || "";
        const fullLink = href.startsWith('http') ? href : `https://www.lacoopeencasa.coop${href}`;

        // Promo: class="descripcion" inside the "bandera-listado" div
        const promoEl = card.querySelector('.bandera-listado .descripcion');
        const promoText = promoEl?.textContent?.trim() || null;

        return { name, price, link: fullLink, promoText };
      });
    });

    const validProducts = products.filter(p => p.name.length > 0 && p.price > 0);
    console.log(`[La Coope] Found ${validProducts.length} items`);
    
    return validProducts;

  } catch (err) {
    console.error("[La Coope Scraper Error]:", err);
    return [];
  }
}