import { Worker } from 'bullmq';
import { ScraperFactory } from '../scrapper/scraper.factory';
import { prisma } from '../prisma';
import { extractBrand } from '../utils/brandMapper';
import { redisConfig } from '../config/redis.config';


// src/workers/scrape.worker.ts
const worker = new Worker('scraper-queue', async (job) => {
  const { query, store } = job.data;
  
  // The Factory handles the "which scraper" logic
  const results = await ScraperFactory.run(store, query);

  if (results.length > 0) {
    const dataToSave = results.map(product => ({
      store: store.toUpperCase(),
      product_query: query,
      product_name: product.name,
      brand: extractBrand(product.name), // Global mapper still works!
      price: product.price,
      url: product.link,
    }));

    await prisma.price.createMany({ data: dataToSave, skipDuplicates: true });
  }
}, { connection: redisConfig });