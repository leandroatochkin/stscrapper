// src/scrapers/scraper.factory.ts
import { scrapeDia } from './dia.scraper';
import { scrapeCoto } from './coto.scraper';
//import { scrapeCarrefour } from './carrefour.scrapper'; // Future

export class ScraperFactory {
  static async run(store: string, query: string) {
    switch (store.toUpperCase()) {
      case 'DIA':
        return await scrapeDia(query);
      case 'COTO':
        return await scrapeCoto(query);
      default:
        throw new Error(`Scraper for ${store} not implemented`);
    }
  }
}