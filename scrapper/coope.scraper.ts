import { Page } from "playwright";
import { parseHtml, ScrapeConfig } from "../utils/htmlParser";
import * as cheerio from 'cheerio';

const SEARCH_BASE_URL = "https://www.lacoopeencasa.coop/listado/busqueda-avanzada/";

export async function scrapeLaCoope(page: Page, query: string) {
  const url = `${SEARCH_BASE_URL}${encodeURIComponent(query)}`;

  const laCoopeConfig: ScrapeConfig = {
    container: "col-listado-articulo", 
    name: ".articulo-descripcion",
    link: 'a[href*="/producto/"]',
    price: {
      wrapper: ".precio-listado", 
      integer: ".precio-entero",
      fraction: ".precio-decimal"
    },
    promo: ".texto-bandera .descripcion, .bandera-listado .descripcion",
    baseUrl: "https://www.lacoopeencasa.coop",
    sku: ''
  };

  try {
    console.log(`[La Coope] Navigating to: ${url}`);

    // 1. Angular sites need networkidle to finish data hydration
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // 2. Wait for the products to actually appear in the DOM
    try {
      await page.waitForSelector('.articulo-descripcion', { timeout: 20000 });
    } catch (e) {
      console.warn("[La Coope] Products didn't hydrate in time.");
    }

    // 3. Trigger small scroll for lazy loading
    //await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1500);

    const html = await page.content();
    const $ = cheerio.load(html);
    
    // 4. Extract Products using the standardized parser
    const products = parseHtml(html, laCoopeConfig, "COOPERATIVA_OBRERA");

    // 5. ENRICHMENT (Following the Carrefour/Cencosud Pattern)
    return products.map(p => {
      const skuFromUrl = p.link.split('/').filter(Boolean).pop();
      const productContainer = $(`col-listado-articulo:has(a[href*="${skuFromUrl}"])`);

      const href = productContainer.closest('a').attr('href') || 
                   productContainer.find('a').attr('href') || 
                   productContainer.parent('a').attr('href') || "";
      console.log(href)
      // 1. IMPROVED SELECTORS for La Coope
      // They use .precio-anterior for the crossed-out price
      const sellingPriceText = productContainer.find('.precio-listado').first().text();
      const listPriceText = productContainer.find('.precio-anterior').first().text();
      const promoBadge = productContainer.find('.texto-bandera .descripcion, .bandera-listado .descripcion').first().text().trim();

      const htmlSellingPrice = parseLaCoopePrice(sellingPriceText);
      let htmlOriginalPrice = parseLaCoopePrice(listPriceText);

      // 2. FIX: If no original price was found but there is a percentage badge
      // We back-calculate it so discountPct isn't 0
      if ((!htmlOriginalPrice || htmlOriginalPrice === htmlSellingPrice) && promoBadge.includes('%')) {
        const discountMatch = promoBadge.match(/(\d+)/);
        if (discountMatch) {
          const percentage = parseInt(discountMatch[1]);
          // Formula: Original = Selling / (1 - (Percentage/100))
          htmlOriginalPrice = Math.round(htmlSellingPrice / (1 - (percentage / 100)));
        }
      }

      // 3. FINAL ASSIGNMENT
      const finalPrice = htmlSellingPrice || p.price;
      const finalOriginalPrice = htmlOriginalPrice || finalPrice;

      return {
        ...p,
        sku: skuFromUrl || p.sku,
        price: finalPrice,
        originalPrice: finalOriginalPrice,
        promoText: promoBadge || p.promoText,
        brand: p.name.split(' ')[0],
        url: `${laCoopeConfig.baseUrl}${href}`
      };
    });

  } catch (err) {
    console.error("[La Coope Scraper Error]:", err);
    return [];
  }
}

/**
 * Standardized Argentine currency parser for La Coope
 * Handles format: $ 1.234,56
 */
function parseLaCoopePrice(text: string): number {
  if (!text) return 0;
  // Remove $ and spaces, handle Argentine decimals
  const cleaned = text.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  return parseFloat(cleaned) || 0;
}