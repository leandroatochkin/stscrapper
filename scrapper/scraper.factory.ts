// src/scrapers/scraper.factory.ts
import { scrapeDia } from './dia.scrapper';
//import { scrapeCarrefour } from './carrefour.scrapper'; // Future

export class ScraperFactory {
  static async run(store: string, query: string) {
    switch (store.toUpperCase()) {
      case 'DIA':
        return await scrapeDia(query);
    //   case 'CARREFOUR':
    //     return await scrapeCarrefour(query);
      default:
        throw new Error(`Scraper for ${store} not implemented`);
    }
  }
}