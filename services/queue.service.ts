import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis.config';

export const scrapeQueue = new Queue('dia-scraper', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3, // Retry 3 times if Dia fails
    backoff: { type: 'exponential', delay: 5000 }, // Wait 5s before retrying
    removeOnComplete: true, // Clean up Redis after success
  }
});