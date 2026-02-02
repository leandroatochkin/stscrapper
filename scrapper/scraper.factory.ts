import { scrapeDia } from './dia.scraper';
import { scrapeCoto } from './coto.scraper';
import { scrapeToledo } from './toledo.scraper';
import { scrapeCencosud } from './cencosud.scraper';
import { Browser } from 'playwright';

export class ScraperFactory {
  // Pass the browser instance into the run method
  static async run(browser: Browser, store: string, query: string) {
    // Create a fresh, isolated context and page for THIS specific scrap job
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    try {
      switch (store.toUpperCase()) {
        case 'DIA':
          // Update these scrapers to accept 'page' just like Cencosud!
          return await scrapeDia(page, query);
        case 'COTO':
          return await scrapeCoto(page, query);
        case 'TOLEDO':
          return await scrapeToledo(page, query);
        case 'JUMBO':
        case 'DISCO':
        case 'VEA':
          return await scrapeCencosud(page, store, query);
        case 'CARREFOUR':
        case 'CHANGOMAS':
          console.warn(`[Factory] Scraper for ${store} not yet implemented.`);
          return [];
        default:
          throw new Error(`Scraper for ${store} not implemented`);
      }
    } finally {
      // CRITICAL: Close the page and context when done, 
      // but leave the browser open for the next store.
      await page.close();
      await context.close();
    }
  }
}