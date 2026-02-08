import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { scrapeDia } from "./scrapper/dia.scraper";
import { prisma } from "./prisma";
import { searchRoutes } from "./routes/search.routes";
import { pricesRoutes } from "./routes/prices.routes";
import { adminRoutes } from "./routes/admin.routes";
import rateLimit from "@fastify/rate-limit";
import { cleanOldFiles } from "./utils/screenshotCleanup";
import './cron/priceCleanup'


export const app = Fastify({
  logger: {
    level: "info",
    // transport: {
    //   targets: [
    //     // Log to console (pretty colors for dev)
    //     {
    //       target: 'pino-pretty',
    //       options: { colorize: true },
    //       level: 'info'
    //     },
    //     // Log to a file (JSON format for production analysis)
    //     {
    //       target: 'pino/file',
    //       options: { destination: './logs/app.log', mkdir: true },
    //       level: 'error'
    //     }
    //   ]
    // } // change to 'debug' when needed
  },
});
app.register(cors, {
  origin: true,
});

cleanOldFiles('screenshots', 3);

setInterval(() => {
  console.log('[System] Running daily maintenance...');
  cleanOldFiles('screenshots', 3);
}, 24 * 60 * 60 * 1000);

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

  app.setErrorHandler((error: any, request, reply) => {
  // Log the error details with Pino
    request.log.error({
      err: error,
      requestId: request.id,
      url: request.raw.url,
      query: request.query,
      // Add custom metadata to help debugging
      context: 'API_GLOBAL_ERROR'
    });

    // Send a clean response to the user
    reply.status(error.statusCode || 500).send({
      status: "ERROR",
      message: error.message || "An unexpected error occurred",
      requestId: request.id // Helpful for the user to report issues
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

