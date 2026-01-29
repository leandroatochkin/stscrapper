export const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  // Add password if your production Redis requires it
  // password: process.env.REDIS_PASSWORD 
};