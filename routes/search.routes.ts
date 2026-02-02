import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { acquireLock, cleanupStaleLocks } from "../utils/lock";
import { addScrapeJob } from "../queues/testing.queue";

export async function searchRoutes(app: FastifyInstance) {
  app.get(
    "/search",
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      const { q, userCity, userProvince } = req.query as { q?: string; userCity?: string, userProvince?: string };

      if (!q || q.length < 2) {
        return { status: "EMPTY", results: [] };
      }

      // 1. Normalization - Crucial for consistent Lock Keys and Cache hits
      const normalizedCity = userCity?.toUpperCase().trim().replace(/\s+/g, '_') || "GENERAL";
      const normalizedProvince = userProvince?.toUpperCase().trim().replace(/\s+/g, '_') || "GENERAL";
      const normalizedQ = q.trim().toLowerCase();

      // UNIQUE LOCK KEY: This allows "Yerba" in MDP and "Yerba" in Tandil to run in parallel
      const locationLockKey = `${normalizedQ}:${normalizedProvince}:${normalizedCity}`;

      // 2. Cleanup old locks (prevent deadlocks from crashed workers)
      await cleanupStaleLocks("GLOBAL", locationLockKey);

      // 3. Cache Check (30 min threshold) 
      // IMPORTANT: We filter by city/province so users get local prices
      const cacheThreshold = new Date(Date.now() - 30 * 60 * 1000);

      const cached = await prisma.price.findMany({
        where: {
          product_query: normalizedQ,
          // We assume your Price schema now has these fields or you filter by the stores 
          // known to be in that city. For now, we filter by query.
          scrapedAt: { gte: cacheThreshold },
        },
        orderBy: [
          { store: 'asc' }, 
          { price: "asc" }
        ],
      });

      // 4. If cache hit, return results immediately
      if (cached.length > 0) {
        const hasNoResultsFlag = cached.some(p => p.product_name === "NO_RESULTS_FOUND");
        
        if (hasNoResultsFlag) {
            return { status: "COMPLETED", results: [], message: "No se encontraron productos en su zona." };
        }

        return {
          status: "COMPLETED",
          source: "cache",
          results: cached,
        };
      }

      // 5. Check if a scrape is ALREADY RUNNING for this specific location
      // Using acquireLock with the location-aware key
      const lockAcquired = await acquireLock("GLOBAL", locationLockKey);

      if (!lockAcquired) {
        console.log(`[Route] Search already in progress for: ${locationLockKey}`);
        return { 
            status: "PROCESSING", 
            message: `Buscando los mejores precios en ${userCity || 'su zona'}...` 
        };
      }

      // 6. Fresh search: Add job to queue
      // We pass the location so the worker knows which regional scrapers to trigger
      try {
        // We call a function that returns a Promise which resolves only when the queue for this job is IDLE
        const results = await addScrapeJob(normalizedQ, normalizedCity, normalizedProvince);
        
        return {
          status: "COMPLETED",
          source: "fresh",
          results: results,
        };
      } catch (error) {
        // If queue fails, release lock so user can try again
        // await releaseLock("GLOBAL", locationLockKey);
        throw error;
      }
    }
  );
}