import PQueue from 'p-queue';
import { ScraperFactory } from '../scrapper/scraper.factory';
import { prisma } from '../prisma';
import { extractBrand } from '../utils/brandMapper';
import { releaseLock } from '../utils/lock';
import { getStoresForLocation } from '../utils/helpers';
import { getBrowserInstance } from '../utils/browserManager';

// Concurrency: 1 means it will process one store at a time (saves RAM)
export const scrapeQueue = new PQueue({ concurrency: 2 });

export const addScrapeJob = async (query: string, city: string, province: string) => {
  const lockKey = `${query}:${province}:${city}`;
  const browser = await getBrowserInstance();

  // RETURN the result of scrapeQueue.add so the route can await it
  return await scrapeQueue.add(async () => {
    const stores = getStoresForLocation(city, province);
    let totalItemsSaved = 0;

    console.log(`[Queue] Starting Full Search for: "${query}" in ${city}`);

    try {
      // Use Promise.all inside the queue task
      await Promise.all(stores.map(async (store) => {
        try {
          await new Promise(r => setTimeout(r, Math.random() * 1000));
          const results = await ScraperFactory.run(browser, store, query);
          
          if (results && results.length > 0) {
            const dataToSave = results.map(product => ({
              store: store.toUpperCase(),
              product_query: query,
              product_name: product.name,
              brand: extractBrand(product.name),
              price: product.price,
              promo_text: product.promoText || "",
              url: product.link,
            }));

            const saved = await prisma.price.createMany({ 
              data: dataToSave, 
              skipDuplicates: true 
            });
            
            totalItemsSaved += saved.count;
            console.log(`[Queue] Saved ${saved.count} items from ${store}`);
          }
        } catch (err: any) {
          console.error(`[Queue] Error scraping ${store}:`, err.message);
        }
      }));

      if (totalItemsSaved === 0) {
        await prisma.price.create({
          data: {
            store: "NONE",
            product_query: query,
            product_name: "NO_RESULTS_FOUND",
            brand: "NONE",
            price: 0,
            url: `empty:${lockKey}:${Date.now()}`
          }
        });
      }

      // IMPORTANT: After saving, fetch the items to return them to the search route
      return await prisma.price.findMany({
        where: { product_query: query },
        orderBy: { price: 'asc' }
      });

    } catch (fatalErr) {
      console.error(`[Queue] Fatal error in job:`, fatalErr);
      return [];
    } finally {
      await releaseLock('GLOBAL', lockKey); 
      console.log(`[Worker] Finished. Total saved: ${totalItemsSaved}. Lock released: ${lockKey}`);
    }
  });
};