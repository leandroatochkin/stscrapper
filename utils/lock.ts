import { prisma } from '../prisma'

export async function cleanupStaleLocks(store: string, query: string) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  await prisma.scrapeLock.deleteMany({
    where: {
      store,
      product_query: query,
      locked_at: { lt: fiveMinutesAgo }
    }
  });
}

export async function acquireLock(
  store: string,
  query: string
): Promise<boolean> {
  try {
    // We use a transaction to ensure atomicity
    return await prisma.$transaction(async (tx) => {
      // 1. Try to insert the lock record. If it exists, 'DO NOTHING'
      await tx.$executeRaw`
        INSERT INTO "ScrapeLock" (store, "product_query", "locked_at")
        VALUES (${store}, ${query}, NOW())
        ON CONFLICT (store, "product_query") DO NOTHING
      `;

      // 2. Try to lock the row. 
      // NOWAIT will throw error 55P03 if another transaction holds the lock.
      await tx.$executeRaw`
        SELECT 1 FROM "ScrapeLock"
        WHERE store = ${store} AND "product_query" = ${query}
        FOR UPDATE NOWAIT
      `;

      return true; 
    }, {
      maxWait: 5000, 
      timeout: 10000 
    });
  } catch (err: any) {
    // 55P03: Postgres lock error
    // P2028: Prisma transaction timeout
    // P2010: Raw query failed (the one you saw in your logs)
    const isLockError = 
      err.code === "P2010" || 
      err.code === "P2028" || 
      err.message?.includes("55P03") || 
      err.message?.includes("could not obtain lock");

    if (isLockError) {
      console.log(`[Lock] Lock already held for ${store}:${query}. Skipping.`);
      return false; 
    }
    
    // If it's a different error, we still want to know about it
    console.error("[Lock Error]:", err);
    return false;
  }
}

export async function releaseLock(store: string, query: string) {
  try {
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