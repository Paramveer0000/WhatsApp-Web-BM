import Redis from 'ioredis';
import { logger } from '../logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

export function getRedisConnection(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn({ REDIS_URL }, 'Redis connection unavailable. BullMQ queue will run in fallback persistent mode.');
          return null; // Stop retrying repeatedly to prevent noisy logs
        }
        return Math.min(times * 1000, 3000);
      },
    });

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      logger.info('Connected to Redis');
    });

    redisClient.on('error', (err) => {
      isRedisAvailable = false;
      logger.debug({ err: err.message }, 'Redis connection notice');
    });
  }

  return redisClient;
}

export function isRedisConnected(): boolean {
  return isRedisAvailable;
}

