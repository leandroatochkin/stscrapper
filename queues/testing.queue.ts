import PQueue from 'p-queue';
import { ScraperFactory } from '../scrapper/scraper.factory';
import { prisma } from '../prisma';
import { extractBrand } from '../utils/brandMapper';
import { releaseLock } from '../utils/lock';

// Concurrency: 1 means it will process one store at a time (saves RAM)
export const scrapeQueue = new PQueue({ concurrency: 1 });

export const addScrapeJob = (store: string, query: string) => {
  // We don't await this; it returns immediately and runs in background
  scrapeQueue.add(async () => {
    console.log(`[Queue] Starting: ${store} for ${query}`);
    try {
      const results = await ScraperFactory.run(store, query);

      if (results.length > 0) {
        const dataToSave = results.map(product => ({
          store: store.toUpperCase(),
          product_query: query,
          product_name: product.name,
          brand: extractBrand(product.name),
          price: product.price,
          url: product.link,
        }));

        await prisma.price.createMany({ 
          data: dataToSave, 
          skipDuplicates: true 
        });
        console.log(`[Queue] Saved ${results.length} items for ${query}`);
      }
    } catch (err) {
      console.error(`[Queue] Failed ${store} for ${query}:`, err);
    } finally {
      // 3. ALWAYS release the lock so the next poll/search can proceed
      await releaseLock(store, query);
      console.log(`[Worker] Lock released for ${store}:${query}`);
    }
  });
};