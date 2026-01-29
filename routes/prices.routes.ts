import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";

export async function pricesRoutes(app: FastifyInstance) {
  app.get("/prices", async () => {
    return prisma.price.findMany({
      orderBy: { scrapedAt: "desc" },
    });
  });
}
