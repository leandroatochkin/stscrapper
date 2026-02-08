import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { acquireLock, cleanupStaleLocks } from "../utils/lock";
import { addScrapeJob } from "../queues/testing.queue";

export async function searchRoutes(app: FastifyInstance) {
  app.get(
    "/search",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const { q, userCity, userProvince, page = "1", limit = "10" } = req.query as { 
        q?: string; 
        userCity?: string; 
        userProvince?: string;
        page?: string;
        limit?: string;
      };

      if (!q || q.length < 2) return { status: "EMPTY", results: [] };

      // 1. Normalization
      const normalizeLoc = (val?: string) => 
        val?.toUpperCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_') || "GENERAL";
      
      const normalizedCity = normalizeLoc(userCity);
      const normalizedProvince = normalizeLoc(userProvince);
      const normalizedQ = q.trim().toLowerCase();
      const locationLockKey = `${normalizedQ}:${normalizedProvince}:${normalizedCity}`;

      const take = parseInt(limit);
      const skip = (parseInt(page) - 1) * take;

      // 2. Helper function to track trends (Async, don't await it to block response)
      const trackSearch = async (count: number) => {
        try {
          await prisma.searchTrend.create({
            data: {
              query: normalizedQ,
              city: normalizedCity,
              province: normalizedProvince,
              resultsCount: count,
            }
          });
        } catch (e: any) {
          app.log.error("[Trend Tracking Error]:", e);
        }
      };

      // 3. Cache Check
      const cacheThreshold = new Date(Date.now() - 30 * 60 * 1000);
      const cached = await prisma.price.findMany({
        where: {
          product_query: normalizedQ,
          scrapedAt: { gte: cacheThreshold },
        },
        orderBy: [{ store: 'asc' }, { price: "asc" }],
        take,
        skip,
      });

      if (cached.length > 0) {
        const totalCount = await prisma.price.count({
          where: { product_query: normalizedQ, scrapedAt: { gte: cacheThreshold } }
        });

        // Track the search in the background
        trackSearch(totalCount);

        const hasNoResultsFlag = cached.some(p => p.product_name === "NO_RESULTS_FOUND");
        if (hasNoResultsFlag) return { status: "COMPLETED", results: [], message: "Sin resultados." };

        return {
          status: "COMPLETED",
          source: "cache",
          results: cached,
          pagination: { total: totalCount, hasMore: skip + take < totalCount }
        };
      }

      // 4. Lock & Fresh Search
      await cleanupStaleLocks("GLOBAL", locationLockKey);
      const lockAcquired = await acquireLock("GLOBAL", locationLockKey);

      if (!lockAcquired) {
        return { status: "PROCESSING", message: "Buscando..." };
      }

      try {
        const results = await addScrapeJob(normalizedQ, normalizedCity, normalizedProvince);
        
        // Track the fresh search results count
        trackSearch(results.length);

        return {
          status: "COMPLETED",
          source: "fresh",
          results: results.slice(0, take),
          pagination: { total: results.length, hasMore: results.length > take }
        };
      } catch (error) {
        app.log.error(error);
        throw error;
      }
    }
  );
}