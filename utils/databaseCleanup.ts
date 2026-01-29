import { prisma } from '../prisma';

export async function cleanupDatabase() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const deleted = await prisma.price.deleteMany({
    where: {
      scrapedAt: { lt: oneWeekAgo }
    }
  });

  return deleted.count;
}