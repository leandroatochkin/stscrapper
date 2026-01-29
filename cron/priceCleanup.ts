import cron from 'node-cron';
import { cleanupDatabase } from '../utils/databaseCleanup';

cron.schedule('0 3 * * *', async () => {
  console.log('[Cron] Running nightly database cleanup...');
  const count = await cleanupDatabase();
  console.log(`[Cron] Cleanup complete. Removed ${count} stale prices.`);
}, {
  timezone: "America/Argentina/Buenos_Aires"
});