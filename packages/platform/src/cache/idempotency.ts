import type { Redis } from 'ioredis';

export interface IdempotencyStore {
  /**
   * Atomically record a key. Returns `true` if this is the FIRST time the key
   * has been seen (caller should proceed), or `false` if it already existed
   * (duplicate — caller should skip). Implemented with Redis `SET NX`, so it is
   * race-safe under concurrency (ADR-004) — unlike a read-then-write check.
   */
  markIfFirst(key: string, ttlSeconds?: number): Promise<boolean>;
  /** Non-mutating check: has this key been recorded? */
  seen(key: string): Promise<boolean>;
}

export interface IdempotencyOptions {
  prefix?: string;
  defaultTtlSeconds?: number;
}

/**
 * Redis-backed idempotency store. This is the first, fast line of defense
 * against duplicate processing; the authoritative guard remains the database
 * unique index (ADR-004).
 */
export function createIdempotencyStore(
  redis: Redis,
  options: IdempotencyOptions = {},
): IdempotencyStore {
  const prefix = options.prefix ?? 'idem';
  const defaultTtl = options.defaultTtlSeconds ?? 86_400;
  const buildKey = (key: string): string => `${prefix}:${key}`;

  return {
    async markIfFirst(key: string, ttlSeconds: number = defaultTtl): Promise<boolean> {
      const result = await redis.set(buildKey(key), '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    },
    async seen(key: string): Promise<boolean> {
      const exists = await redis.exists(buildKey(key));
      return exists === 1;
    },
  };
}
