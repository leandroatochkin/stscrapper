import PQueue from 'p-queue';
import { ScraperFactory } from '../scrapper/scraper.factory';
import { prisma } from '../prisma';
import { extractBrand } from '../utils/brandMapper';
import { releaseLock } from '../utils/lock';

// Concurrency: 1 means it will process one store at a time (saves RAM)
export const scrapeQueue = new PQueue({ concurrency: 2 });

export const addScrapeJob = (query: string) => {
  scrapeQueue.add(async () => {
    const stores = ['DIA', 'COTO'];
    console.log(`[Queue] Starting Full Search for: ${query}`);

    try {
      // Run both in parallel within the SAME job
      await Promise.all(stores.map(async (store) => {
        try {
          const results = await ScraperFactory.run(store, query);
          if (results && results.length > 0) {
            const dataToSave = results.map(product => ({
              store: store.toUpperCase(),
              product_query: query,
              product_name: product.name,
              brand: extractBrand(product.name),
              price: product.price,
              promo_text: product.promoText,
              url: product.link,
            }));

            await prisma.price.createMany({ 
              data: dataToSave, 
              skipDuplicates: true 
            });
          }
        } catch (err) {
          console.error(`[Queue] Failed ${store}:`, err);
        }
      }));
    } finally {
      // ONLY release the lock after BOTH stores are finished
      await releaseLock('GLOBAL', query); 
      console.log(`[Worker] All stores finished for ${query}`);
    }
  });
};