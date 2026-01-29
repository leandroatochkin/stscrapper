import { prisma } from '../prisma'

export async function cleanupStaleLocks(store: string, query: string) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  await prisma.scrapeLock.deleteMany({
    where: {
      store,
      product_query: query,
      locked_at: { lt: fiveMinutesAgo } // ONLY delete if older than 5 mins
    }
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
  try {
    // deleteMany doesn't throw if the record is missing
    await prisma.scrapeLock.deleteMany({
      where: {
        store: store,
        product_query: query,
      },
    });
  } catch (error) {
    console.error("Error releasing lock:", error);
  }
}

