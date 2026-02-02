import { scrapeDia } from './dia.scraper';
import { scrapeCoto } from './coto.scraper';
import { scrapeToledo } from './toledo.scraper';
import { scrapeCencosud } from './cencosud.scraper';
import { scrapeCarrefour } from './carrefour.scraper';
import { Browser } from 'playwright';
import { USER_AGENTS } from '../utils/browserManager';
import path from 'path';
import fs from 'fs';

export class ScraperFactory {
  static async run(browser: Browser, store: string, query: string) {
    
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
          results = await scrapeCarrefour(page, query);
          break;
        default:
          console.warn(`[Factory] Scraper for ${store} not implemented.`);
          return [];
      }

      // 2. DIAGNOSTIC CHECK: If results are empty, take a low-res screenshot
      if (!results || results.length === 0) {
        await this.takeDiagnosticScreenshot(page, store, query);
      }

      return results;

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