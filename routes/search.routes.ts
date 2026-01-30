import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { acquireLock, releaseLock, cleanupStaleLocks } from "../utils/lock";
import { addScrapeJob } from "../queues/testing.queue";

export async function searchRoutes(app: FastifyInstance) {
  app.get(
    "/search",
    {
      config: {
        rateLimit: {
          max: 60, // Increased slightly for polling
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      const { q, store = "DIA" } = req.query as { q?: string; store?: string };

      if (!q || q.length < 2) {
        return { status: "EMPTY", results: [] };
      }

      const normalizedQ = q.trim().toLowerCase();

      // 1. Cleanup old locks first
      await cleanupStaleLocks(store, normalizedQ);

      // 2. Cache Check (30 min threshold)
      const cacheThreshold = new Date(Date.now() - 30 * 60 * 1000);

      const cached = await prisma.price.findMany({
        where: {
          //store: store.toUpperCase(),
          product_query: normalizedQ,
          scrapedAt: { gte: cacheThreshold },
        },
        orderBy: [
          { store: 'asc' }, // Group by store
          { price: "asc" }  // Then sort by cheapest
        ],
      });

      // 3. If cache hit, return results immediately
      if (cached.length > 0) {
        
        const filteredResults = cached.filter(p => p.product_name !== "NO_RESULTS_FOUND");

        return {
          status: "COMPLETED",
          source: "cache",
          results: filteredResults,
        };
      }

      const lockKey = `GLOBAL_${normalizedQ}`;

      // 1. Check if it's CURRENTLY locked
      const existingLock = await prisma.scrapeLock.findFirst({
        where: { product_query: normalizedQ } // Check if ANY store is currently locking this query
      });

      if (existingLock) {
        console.log(`[Route] Lock exists: ${existingLock.store} for ${normalizedQ}`);
        return { status: "PROCESSING", message: "Updating prices for all stores..." };
      }

      // 4. Cache miss: Check if a scrape is already RUNNING (Lock check)
      // We use your existing lock logic to prevent duplicate queue jobs
      const lockAcquired = await acquireLock("GLOBAL", normalizedQ);

      if (lockAcquired) {
          addScrapeJob(normalizedQ);
          //addScrapeJob("DIA", normalizedQ);
          return { status: "STARTED" };
        }

      // 5. If we got here, it's a fresh search and we own the lock.
      // Add to the simple queue. 
      // IMPORTANT: We do NOT 'await' this. It runs in the background.
      req.log.warn({ q: normalizedQ }, "Adding job to simple queue");
      
      addScrapeJob(normalizedQ);
      //addScrapeJob("DIA", normalizedQ);

      // 6. Respond immediately so the frontend can show a loader
      return {
        status: "STARTED",
        message: "Scrape initiated. Polling recommended.",
      };
    }
  );
}

