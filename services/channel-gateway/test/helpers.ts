import type { IdempotencyStore } from '@cx-orbit/platform';
import type { AnyEvent } from '@cx-orbit/shared';
import type { EventPublisher } from '../src/ingest.js';

/** In-memory idempotency store mirroring Redis SET NX semantics. */
export function createFakeIdempotency(): IdempotencyStore {
  const keys = new Set<string>();
  return {
    async markIfFirst(key: string): Promise<boolean> {
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    },
    async seen(key: string): Promise<boolean> {
      return keys.has(key);
    },
  };
}

/** Recording publisher for assertions. */
export function createFakePublisher(): EventPublisher & { readonly published: AnyEvent[] } {
  const published: AnyEvent[] = [];
  return {
    published,
    async publish(event: AnyEvent): Promise<void> {
      published.push(event);
    },
  };
}
