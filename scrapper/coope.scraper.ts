import { Page } from "playwright";
import { parseHtml, ScrapeConfig } from "../utils/htmlParser";

const SEARCH_BASE_URL = "https://www.lacoopeencasa.coop/listado/busqueda-avanzada/";

export async function scrapeLaCoope(page: Page, query: string) {
  const url = `${SEARCH_BASE_URL}${encodeURIComponent(query)}`;

  const laCoopeConfig: ScrapeConfig = {
    container: "col-listado-articulo", // Using the Angular component tag as the container
    name: ".articulo-descripcion",
    link: 'a[href*="/producto/"]',
    price: {
      wrapper: ".precio-listado", // Standardizing to the specific price box
      integer: ".precio-entero",
      fraction: ".precio-decimal"
    },
    promo: ".texto-bandera .descripcion, .bandera-listado .descripcion",
    baseUrl: "https://www.lacoopeencasa.coop"
  };

  try {
    console.log(`[La Coope] Navigating to: ${url}`);

    // 1. Wait for network to be quiet so Angular can finish its API calls
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // 2. Wait for the specific description element to ensure the data is "there"
    await page.waitForSelector('.articulo-descripcion', { timeout: 20000 }).catch(() => {
        console.warn("[La Coope] Products didn't hydrate in time.");
    });

    // 3. Force a small scroll to trigger any lazy-loading logic they might have
    //await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);

    const html = await page.content();
    
    // Standardized parser will handle the brand extraction and price math
    const products = parseHtml(html, laCoopeConfig, "COOPERATIVA_OBRERA");

    console.log(`[La Coope] Found ${products.length} items.`);
    return products;

  } catch (err) {
    console.error("[La Coope Scraper Error]:", err);
    return [];
  }
}