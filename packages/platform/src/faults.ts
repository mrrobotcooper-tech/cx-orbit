/**
 * Redis-backed fault flags used by the Incident Simulator to influence other
 * services without restarting them (Phase 10).
 */
import type { Redis } from './cache/redis.js';

const PREFIX = 'cxorbit:fault:';

export const FAULT_KEYS = {
  /** Outbound webchat simulator fault: none|timeout|error|rate_limit */
  WEBCHAT_SIMULATE: 'webchat_simulate',
  /** AI force failure mode (matches AI_FORCE_FAILURE values). */
  AI_FORCE_FAILURE: 'ai_force_failure',
  /** Artificial Mongo/Postgres delay in ms for conversation/customer paths. */
  DB_LATENCY_MS: 'db_latency_ms',
  /** When "1", conversation outbox relay drops publishes (simulates event loss). */
  OUTBOX_DROP: 'outbox_drop',
} as const;

export interface FaultStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  clearAll(): Promise<void>;
}

export function createFaultStore(redis: Redis): FaultStore {
  return {
    async get(key: string): Promise<string | null> {
      return redis.get(`${PREFIX}${key}`);
    },
    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
      if (ttlSeconds !== undefined) {
        await redis.set(`${PREFIX}${key}`, value, 'EX', ttlSeconds);
      } else {
        await redis.set(`${PREFIX}${key}`, value);
      }
    },
    async del(key: string): Promise<void> {
      await redis.del(`${PREFIX}${key}`);
    },
    async clearAll(): Promise<void> {
      const keys = await redis.keys(`${PREFIX}*`);
      if (keys.length > 0) await redis.del(...keys);
    },
  };
}
