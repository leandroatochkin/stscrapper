import { prisma } from '../prisma'

export async function cleanupStaleLocks(store: string, query: string) {
  await prisma.scrapeLock.deleteMany({
    where: {
      store,
      product_query: query,
      locked_at: {
        lt: new Date(Date.now() - 5 * 60 * 1000),
      },
    },
  });
}

export async function acquireLock(
  store: string,
  query: string
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "ScrapeLock" (store, "product_query")
        VALUES (${store}, ${query})
        ON CONFLICT (store, "product_query") DO NOTHING
      `;

      await tx.$executeRaw`
        SELECT 1
        FROM "ScrapeLock"
        WHERE store = ${store}
          AND "product_query" = ${query}
        FOR UPDATE NOWAIT
      `;
    });

    return true; // lock acquired
  } catch (err: any) {
    // Postgres: could not obtain lock
    if (err.code === "55P03") {
      return false;
    }
    throw err;
  }
}


export async function releaseLock(store: string, query: string) {
  await prisma.scrapeLock.delete({
    where: {
      store_product_query: {
        store,
        product_query: query,
      },
    },
  });
}

