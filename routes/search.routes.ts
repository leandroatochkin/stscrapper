import { FastifyInstance } from "fastify";
import { scrapeDia } from "../scrapper/dia.scrapper";
import { prisma } from "../prisma";
import { acquireLock, releaseLock, cleanupStaleLocks } from "../utils/lock";
import { extractBrand } from "../utils/brandMapper";

export async function searchRoutes(app: FastifyInstance) {
  app.get(
    "/search",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "10 minutes",
        },
      },
    },
    async (req) => {
      const { q } = req.query as { q?: string };

      if (!q || q.length < 2) {
        return { source: "empty", results: [] };
      }

      const normalizedQ = q.trim().toLowerCase();

      await cleanupStaleLocks("DIA", normalizedQ);

      const cacheThreshold = new Date(
        Date.now() - 30 * 60 * 1000
      );


      const cached = await prisma.price.findMany({
        where: {
          store: "DIA",
          product_query: normalizedQ,
          scrapedAt: { gte: cacheThreshold },
        },
        orderBy: { price: "asc" },
      });

      console.log("SENDING TO FRONTEND:", JSON.stringify(cached, null, 2));

      if (cached.length > 0) {
        const lastUpdated = cached[0]?.scrapedAt;
        req.log.info({ q: normalizedQ }, "Returning cached prices");
        return {
          source: "cache",
          lastUpdated,
          results: cached,
        };
      }
       
      req.log.warn(
        { q: normalizedQ, ip: req.ip },
        "Cache miss — scraping DIA"
      );

      let lockAcquired = false;

      try {

        lockAcquired = await acquireLock("DIA", normalizedQ);
        
        if (!lockAcquired) {
          req.log.warn({ q: normalizedQ }, "Scrape in progress — returning stale cache");

          return {
            source: "cache-stale",
            results: cached, // may be empty
          };
        }

        req.log.warn({ q: normalizedQ }, "Lock acquired — scraping DIA");

        const results = await scrapeDia(normalizedQ);
        console.log(results)

        // for (const product of results) {
        //   if (!product.price || product.price <= 0) continue;

        //   const brand = extractBrand(product.name)

        //   await prisma.price.create({
        //     data: {
        //       store: "DIA",
        //       product_query: normalizedQ,
        //       product_name: product.name,
        //       brand: brand,
        //       price: product.price,
        //       url: product.link,
        //     },
        //   });
          
        // }

        const dataToSave = results
            .filter(product => product.price > 0)
            .map(product => ({
              store: "DIA",
              product_query: normalizedQ,
              product_name: product.name,
              brand: extractBrand(product.name), // Mapping happens here
              price: product.price,
              url: product.link,
              // scrapedAt: new Date() // Prisma usually handles this via default(now())
            }));

        if (dataToSave.length > 0) {
          // Bulk insert is much faster than multiple awaits in a loop
          await prisma.price.createMany({
            data: dataToSave,
            skipDuplicates: true, // Useful if your DB has unique constraints
          });
        }

      } finally {
        if (lockAcquired) {
          await releaseLock("DIA", normalizedQ);
          req.log.info({ q: normalizedQ }, "Lock released");
        }
      }

      const fresh = await prisma.$queryRaw`
        SELECT *
        FROM (
          SELECT DISTINCT ON (url)
            store,
            product_name,
            brand,
            price,
            url
          FROM "Price"
          WHERE "product_query" = ${normalizedQ}
            AND store = 'DIA'
          ORDER BY url, price ASC
        ) t
        ORDER BY price ASC;
      `;

      console.log("SENDING TO FRONTEND:", JSON.stringify(fresh, null, 2));
      return { source: "scrape", results: fresh };
    }
  );
}

