import type { Redis } from '@cx-orbit/platform';

export interface DeadLetterEntry {
  idempotencyKey: string;
  conversationId: string;
  channel: string;
  reason: string;
  attempts: number;
  payload: unknown;
  failedAt: string;
}

export interface DeadLetterQueue {
  push(entry: DeadLetterEntry): Promise<void>;
  list(limit?: number): Promise<DeadLetterEntry[]>;
  size(): Promise<number>;
}

/**
 * Redis list-backed DLQ. Newest entries are leftmost; trimmed to maxEntries (ADR-006).
 */
export function createDeadLetterQueue(
  redis: Redis,
  options: { key?: string; maxEntries?: number } = {},
): DeadLetterQueue {
  const key = options.key ?? 'outbound:dlq';
  const maxEntries = options.maxEntries ?? 1000;

  return {
    async push(entry: DeadLetterEntry): Promise<void> {
      await redis.lpush(key, JSON.stringify(entry));
      await redis.ltrim(key, 0, maxEntries - 1);
    },
    async list(limit = 50): Promise<DeadLetterEntry[]> {
      const raw = await redis.lrange(key, 0, limit - 1);
      return raw.map((s) => JSON.parse(s) as DeadLetterEntry);
    },
    async size(): Promise<number> {
      return redis.llen(key);
    },
  };
}
