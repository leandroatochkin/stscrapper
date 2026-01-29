import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { acquireLock, releaseLock, cleanupStaleLocks } from "../utils/lock";
import { addScrapeJob } from "../queues/testing.queue";

// export async function searchRoutes(app: FastifyInstance) {
//   app.get(
//     "/search",
//     {
//       config: {
//         rateLimit: {
//           max: 5,
//           timeWindow: "10 minutes",
//         },
//       },
//     },
//     async (req) => {
//       const { q, store = "DIA" } = req.query as { q?: string; store?: string };

//       if (!q || q.length < 2) {
//         return { source: "empty", results: [] };
//       }

//       const normalizedQ = q.trim().toLowerCase();

//       await cleanupStaleLocks("DIA", normalizedQ);

//       const cacheThreshold = new Date(
//         Date.now() - 30 * 60 * 1000
//       );


//       const cached = await prisma.price.findMany({
//         where: {
//           store: "DIA",
//           product_query: normalizedQ,
//           scrapedAt: { gte: cacheThreshold },
//         },
//         orderBy: { price: "asc" },
//       });

//       console.log("SENDING TO FRONTEND:", JSON.stringify(cached, null, 2));

//       if (cached.length > 0) {
//         const lastUpdated = cached[0]?.scrapedAt;
//         req.log.info({ q: normalizedQ }, "Returning cached prices");
//         return {
//           source: "cache",
//           lastUpdated,
//           results: cached,
//         };
//       }
       
//       req.log.warn(
//         { q: normalizedQ, ip: req.ip },
//         "Cache miss — scraping DIA"
//       );

//       let lockAcquired = false;

//       try {

//         lockAcquired = await acquireLock("DIA", normalizedQ);
        
//         if (!lockAcquired) {
//           req.log.warn({ q: normalizedQ }, "Scrape in progress — returning stale cache");

//           return {
//             source: "cache-stale",
//             results: cached, // may be empty
//           };
//         }

//         req.log.warn({ q: normalizedQ }, "Lock acquired — scraping DIA");

//         const results = await scrapeDia(normalizedQ);
//         console.log(results)

//         const dataToSave = results
//             .filter(product => product.price > 0)
//             .map(product => ({
//               store: "DIA",
//               product_query: normalizedQ,
//               product_name: product.name,
//               brand: extractBrand(product.name), // Mapping happens here
//               price: product.price,
//               url: product.link,
//               // scrapedAt: new Date() // Prisma usually handles this via default(now())
//             }));

//         if (dataToSave.length > 0) {
//           // Bulk insert is much faster than multiple awaits in a loop
//           await prisma.price.createMany({
//             data: dataToSave,
//             skipDuplicates: true, // Useful if your DB has unique constraints
//           });
//         }

//       } finally {
//         if (lockAcquired) {
//           await releaseLock("DIA", normalizedQ);
//           req.log.info({ q: normalizedQ }, "Lock released");
//         }
//       }

//       const fresh = await prisma.$queryRaw`
//         SELECT *
//         FROM (
//           SELECT DISTINCT ON (url)
//             store,
//             product_name,
//             brand,
//             price,
//             url
//           FROM "Price"
//           WHERE "product_query" = ${normalizedQ}
//             AND store = 'DIA'
//           ORDER BY url, price ASC
//         ) t
//         ORDER BY price ASC;
//       `;

//       console.log("SENDING TO FRONTEND:", JSON.stringify(fresh, null, 2));
//       return { source: "scrape", results: fresh };
//     }
//   );
// }

export async function searchRoutes(app: FastifyInstance) {
  app.get(
    "/search",
    {
      config: {
        rateLimit: {
          max: 10, // Increased slightly for polling
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
          store: store.toUpperCase(),
          product_query: normalizedQ,
          scrapedAt: { gte: cacheThreshold },
        },
        orderBy: { price: "asc" },
      });

      // 3. If cache hit, return results immediately
      if (cached.length > 0) {
        return {
          status: "COMPLETED",
          source: "cache",
          results: cached,
        };
      }

      // 1. Check if it's CURRENTLY locked
      const existingLock = await prisma.scrapeLock.findUnique({
        where: { store_product_query: { store: "DIA", product_query: normalizedQ } }
      });

      if (existingLock) {
        // If it's locked and NOT stale, just tell the frontend to keep waiting
        return { status: "PROCESSING", message: "Scrape in progress..." };
      }

      // 4. Cache miss: Check if a scrape is already RUNNING (Lock check)
      // We use your existing lock logic to prevent duplicate queue jobs
      const lockAcquired = await acquireLock(store, normalizedQ);

      if (lockAcquired) {
          addScrapeJob("DIA", normalizedQ);
          return { status: "STARTED" };
        }

      // 5. If we got here, it's a fresh search and we own the lock.
      // Add to the simple queue. 
      // IMPORTANT: We do NOT 'await' this. It runs in the background.
      req.log.warn({ q: normalizedQ }, "Adding job to simple queue");
      
      addScrapeJob(store, normalizedQ);

      // 6. Respond immediately so the frontend can show a loader
      return {
        status: "STARTED",
        message: "Scrape initiated. Polling recommended.",
      };
    }
  );
}

