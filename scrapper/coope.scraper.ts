import { Page } from "playwright";
import * as cheerio from 'cheerio';

const SEARCH_BASE_URL = "https://www.lacoopeencasa.coop/listado/busqueda-avanzada/";
const BASE_URL = "https://www.lacoopeencasa.coop";

export async function scrapeLaCoope(page: Page, query: string) {
  const url = `${SEARCH_BASE_URL}${encodeURIComponent(query)}`;

  try {
    console.log(`[La Coope] Navigating to: ${url}`);
    
    // 1. Navigate and wait for the initial load
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // 2. Wait for the specific card class from your HTML
    try {
      await page.waitForSelector('.tarjeta-articulo', { 
        state: 'visible', 
        timeout: 20000 
      });
    } catch (e) {
      console.warn("[La Coope] Products (.tarjeta-articulo) didn't appear. Checking HTML anyway...");
    }

    const html = await page.content();
    const $ = cheerio.load(html);
    const results: any[] = [];

    // 3. Target the container you provided
    $(".tarjeta-articulo").each((_, el) => {
     // Inside $(".tarjeta-articulo").each((_, el) => { ...

const container = $(el);

// 1. Core Data
const name = container.find(".articulo-descripcion").text().trim();

// 2. Selling Price ($2.025,00)
const priceInteger = container.find(".precio-entero").first().text().trim();
const priceDecimal = container.find(".precio-decimal").first().text().trim();
const sellingPrice = parseComplexPrice(priceInteger, priceDecimal);

// 3. Regular/Original Price ($2.700,00)
// We look for the "precio-tachado" (crossed out price)
const originalPriceText = container.find(".precio-tachado").first().text().trim();
let originalPrice = originalPriceText ? parseLaCoopePrice(originalPriceText) : sellingPrice;

// 4. Promo Text (- 25%)
// We target the .descripcion inside the promo banner
const promoText = container.find(".bandera-listado .descripcion").first().text().trim();

// 5. SKU & URL
const relativeLink = container.find('a[href*="/producto/"]').first().attr('href') || "";
const skuMatch = relativeLink.match(/\/(\d+)$/);
const sku = skuMatch ? skuMatch[1] : "";

if (name && sellingPrice > 0) {
  results.push({
    sku,
    name,
    price: sellingPrice,
    originalPrice: originalPrice,
    promoText: promoText, // Will capture "- 25%"
    url: relativeLink ? `${BASE_URL}${relativeLink}` : "",
    brand: name.split(' ')[0]
  });
}
    });

    console.log(`[La Coope] Scraped ${results.length} products successfully.`);
    return results;

  } catch (err) {
    console.error("[La Coope Scraper Error]:", err);
    return [];
  }
}

/**
 * Parsers the integer ($3.590) and decimal (00) parts
 */
function parseComplexPrice(integerPart: string, decimalPart: string): number {
  const integer = integerPart.replace(/[^\d]/g, '');
  const decimals = decimalPart.replace(/[^\d]/g, '') || "00";
  return parseFloat(`${integer}.${decimals}`) || 0;
}

function parseLaCoopePrice(text: string): number {
  if (!text) return 0;
  // Removes $, ARS, and spaces
  let cleaned = text.replace(/[^\d.,]/g, '');
  // Standard Argentine: 2.700,00 -> remove dot, replace comma with dot
  const lastComma = cleaned.lastIndexOf(',');
  if (lastComma > -1) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/\./g, '');
  }
  return parseFloat(cleaned) || 0;
}