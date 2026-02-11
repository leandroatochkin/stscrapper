import PQueue from 'p-queue';
import { ScraperFactory } from '../scrapper/scraper.factory';
import { prisma } from '../prisma';
import { releaseLock } from '../utils/lock';
import { getBrowserInstance } from '../utils/browserManager';
import { extractBrand } from '../utils/brandMapper';
import { getStoresForLocation } from '../utils/helpers';

export const scrapeQueue = new PQueue({ concurrency: 2 });

export const addScrapeJob = async (query: string, city: string, province: string) => {
  const lockKey = `${query}:${province}:${city}`;
  const browser = await getBrowserInstance();

  return await scrapeQueue.add(async () => {
    const stores = [
      // "CARREFOUR",
      // "DISCO",
      // "VEA",
      // "JUMBO",
      // "CHANGOMAS",
      "COOPERATIVA_OBRERA",
      // "COTO",
      // "DIA",
      // "TOLEDO"
    ];

    //const stores = getStoresForLocation(city, province)
    
    try {
      // FIX 1: Ensure Store ID is EXACTLY what the Factory expects
      // Usually: STORENAME_CITY (e.g., CARREFOUR_MAR_DEL_PLATA)
      await Promise.all(stores.map(storeName => {
        const storeId = `${storeName.toUpperCase()}_${city.toUpperCase().replace(/\s+/g, '_')}`;
        return prisma.store.upsert({
          where: { id: storeId },
          update: {},
          create: {
            id: storeId,
            name: storeName,
            city: city,
            province: province
          }
        });
      }));

      // 2. TRIGGER SCRAPERS
      await Promise.all(stores.map(async (store) => {
        // We await the factory. If it crashes, we catch it here.
        const results = await ScraperFactory.run(browser, store, query, city, province);
        
        // FIX 2: If the factory returned results, we FORCE the brand mapping here
        if (results && results.length > 0) {
          for (const item of results) {
            const correctBrand = extractBrand(item.name || "");
            // This fix ensures the DB is updated even if the Factory messed up
            await prisma.product.update({
              where: { id: item.id },
              data: { brandName: correctBrand }
            });
          }
        }
      }));

      // 3. RETURN DATA
      const finalResults = await prisma.priceRecord.findMany({
        where: {
          product: {
            name: { contains: query, mode: 'insensitive' },
            store: { city: city }
          }
        },
        include: { product: true },
        orderBy: { price: 'asc' }
      });

      // FIX 3: THE ULTIMATE OVERRIDE
      // This ensures that even if the DB update is slow, the user sees "LA SERENISIMA"
      return finalResults.map(r => ({
        ...r,
        product: {
          ...r.product,
          brandName: extractBrand(r.product.name)
        }
      }));

    } catch (err) {
      console.error("Queue error:", err);
      return [];
    } finally {
      await releaseLock('GLOBAL', lockKey);
    }
  });
};