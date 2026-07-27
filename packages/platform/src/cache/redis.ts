import { Redis, type RedisOptions } from 'ioredis';

export { Redis };
export type { RedisOptions };

export interface CreateRedisOptions {
  url: string;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
}

/** Create an ioredis client with sane defaults for the platform. */
export function createRedis(options: CreateRedisOptions): Redis {
  const redisOptions: RedisOptions = {
    maxRetriesPerRequest: options.maxRetriesPerRequest ?? 3,
  };
  if (options.keyPrefix !== undefined) {
    redisOptions.keyPrefix = options.keyPrefix;
  }
  return new Redis(options.url, redisOptions);
}
