import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { scrapeDia } from "./scrapper/dia.scrapper";
import { prisma } from "./prisma";
import { searchRoutes } from "./routes/search.routes";
import { pricesRoutes } from "./routes/prices.routes";
import { adminRoutes } from "./routes/admin.routes";
import rateLimit from "@fastify/rate-limit";
import './cron/priceCleanup'


export const app = Fastify({
  logger: {
    level: "info", // change to 'debug' when needed
  },
});
app.register(cors, {
  origin: true,
});



// const PRODUCTS = ["leche", "arroz", "fideos", "coca cola", "cerveza"];

// app.get("/scrape", async () => {
//   for (const query of PRODUCTS) {
//     const results = await scrapeDia(query);
//     console.log(results)
//     for (const product of results) {
//       await prisma.price.create({
//         data: {
//           store: "DIA",
//           product_query: query,
//           product_name: product.name,
//           price: product.price,
//           url: product.link,
//         },
//       });
//     }
//   }

//   return { status: "done" };
// });

// app.get("/prices", async () => {
//   return prisma.price.findMany({
//     orderBy: { scrapedAt: "desc" },
//   });
// });

app.get("/cheapest", async () => {
  return prisma.$queryRaw`
    SELECT *
        FROM (
        SELECT DISTINCT ON ("product_query")
            store,
            "product_query",
            product_name,
            price,
            url
        FROM "Price"
        ORDER BY "product_query", price ASC
        ) t
        ORDER BY price ASC;
  `;
});

const start = async () => {

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: (req, context) => {
      return {
        error: "Too many requests",
        retryAfter: context.after,
      };
    },
  });
  // 1. Register Plugins/Routes
  await app.register(searchRoutes, { prefix: "/api" });
  await app.register(pricesRoutes, { prefix: "/api" });
  await app.register(adminRoutes)

  // 2. Register Error Handler (MUST BE BEFORE LISTEN)
  app.setErrorHandler((error: any, request, reply) => {
  if (error.code === "FST_ERR_RATE_LIMIT") {
    request.log.warn(
      { ip: request.ip, url: request.url },
      "Rate limit exceeded"
    );

    return reply.status(429).send({
      error: "Too many requests",
    });
  }

  request.log.error(error);
  reply.status(500).send({ error: "Internal Server Error" });
});

  app.setErrorHandler((error: any, request, reply) => {
    request.log.error(
      {
        err: error,
        url: request.url,
        method: request.method,
      },
      "Unhandled error"
    );

    if (error?.code === "P2022") {
      return reply.status(500).send({
        error: "Database schema mismatch",
      });
    }

    reply.status(500).send({
      error: "Internal Server Error",
    });
  });

  // 3. Finally, start listening
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

