import { scrapeDia } from './dia.scraper';
import { scrapeCoto } from './coto.scraper';
import { scrapeToledo } from './toledo.scraper';
import { scrapeCencosud } from './cencosud.scraper';
import { scrapeCarrefour } from './carrefour.scraper';
import { scrapeLaCoope } from './coope.scraper';
import { scrapeChangoMas } from './changomasScraper';
import { Browser } from 'playwright';
import { USER_AGENTS } from '../utils/browserManager';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma';
import { extractBrand } from '../utils/brandMapper';

export class ScraperFactory {
  static async run(
    browser: Browser, 
    store: string, 
    query: string,
    city: string, 
    province: string
  ) {
    
    const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    const context = await browser.newContext({
      userAgent: randomUA,
      viewport: { width: 1280, height: 720 },
      extraHTTPHeaders: {
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
      }
    });
    const page = await context.newPage();

    try {
      let results: any[] = [];

      // 1. Run the specific scraper
      switch (store.toUpperCase()) {
        case 'DIA':
          results = await scrapeDia(page, query);
          break;
        case 'COTO':
          results = await scrapeCoto(page, query);
          break;
        case 'TOLEDO':
          results = await scrapeToledo(page, query);
          break;
        case 'JUMBO':
        case 'DISCO':
        case 'VEA':
          results = await scrapeCencosud(page, store, query);
          break;
        case 'CARREFOUR':
          results = await scrapeCarrefour(query);
          break;
        case 'COOPERATIVA_OBRERA':
          results = await scrapeLaCoope(page, query);
          break;
        case 'CHANGOMAS':
          //results = await scrapeChangoMas(page, query);
          results = await scrapeChangoMas(page, query);
          break;
        default:
          console.warn(`[Factory] Scraper for ${store} not implemented.`);
          return [];
      }
      
      

      // 2. DIAGNOSTIC CHECK: If results are empty, take a low-res screenshot
      if (!results || results.length === 0) {
        await this.takeDiagnosticScreenshot(page, store, query);
      }

      const storeId = `${store.toUpperCase()}_${city.toUpperCase()}`;

      const seenSkus = new Set();
const uniqueResults = results.filter(item => {
  const uniqueKey = `${storeId}_${item.sku}`;
  if (seenSkus.has(uniqueKey)) return false;
  seenSkus.add(uniqueKey);
  return true;
});

const savedProducts = [];

for (const item of uniqueResults) {
  try {
    const uniqueSku = `${storeId}_${item.sku}`;
    
    // Safety check for pricing
    const currentPrice = Number(item.price) || 0;
    const oldPrice = Number(item.originalPrice) || currentPrice;
    const discountPct = oldPrice > currentPrice ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100) : 0;

    const correctBrand = extractBrand(item.name || "");

    const saved = await prisma.product.upsert({
            where: { sku: uniqueSku },
            update: {
              // We update brandName in case it was "LECHE" before and now we have a match
              brandName: correctBrand, 
              prices: {
                create: {
                  price: currentPrice,
                  originalPrice: oldPrice,
                  discountPct: discountPct,
                  promoText: item.promoText || "",
                }
              }
            },
            create: {
              sku: uniqueSku,
              name: item.name || "Producto sin nombre",
              brandName: correctBrand,
              category: item.category || "General",
              url: item.url || "",
              // THE FIX: Move 'connect' inside the 'create' block
              store: { connect: { id: storeId } }, 
              prices: {
                create: {
                  price: currentPrice,
                  originalPrice: oldPrice,
                  discountPct: discountPct,
                  promoText: item.promoText || "",
                }
              }
            }
          });

    savedProducts.push(saved);



          } catch (e) {
            console.error(`[Factory DB Error] Product: ${item.name}`, e);
            return null;
          }
        }
      

      return savedProducts

    } catch (error: any) {
      console.error(`[Factory Error - ${store}]:`, error.message);
      // Also take a screenshot on hard crashes
      await this.takeDiagnosticScreenshot(page, store, `CRASH-${query}`);
      return [];
    } finally {
      await page.close();
      await context.close();
    }
  }

  // Helper method for low-res screenshots
  private static async takeDiagnosticScreenshot(page: any, store: string, query: string) {
    try {
      const dir = './screenshots';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);

      const fileName = `${store}_${query.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
      const filePath = path.join(dir, fileName);

      await page.screenshot({
        path: filePath,
        type: 'jpeg',   // JPEGs are much smaller than PNGs
        quality: 30,    // Low quality (0-100) is plenty for reading error text
        clip: { x: 0, y: 0, width: 1280, height: 800 }, // Only capture the top area
      });

      console.log(`[Diagnostic] Empty results for ${store}. Screenshot: ${filePath}`);
    } catch (err) {
      console.error('[Diagnostic] Failed to save screenshot:', err);
    }
  }
}