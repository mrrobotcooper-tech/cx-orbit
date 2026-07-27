import { describe, expect, it } from 'vitest';
import type { Redis } from 'ioredis';
import { createIdempotencyStore } from '../src/index.js';

/** Minimal in-memory fake of the two Redis commands the store uses. */
function fakeRedis(): Redis {
  const store = new Map<string, string>();
  const fake = {
    async set(
      key: string,
      _value: string,
      _ex: string,
      _ttl: number,
      nx?: string,
    ): Promise<string | null> {
      if (nx === 'NX' && store.has(key)) {
        return null;
      }
      store.set(key, '1');
      return 'OK';
    },
    async exists(key: string): Promise<number> {
      return store.has(key) ? 1 : 0;
    },
  };
  return fake as unknown as Redis;
}

describe('idempotency store', () => {
  it('marks the first occurrence and rejects duplicates', async () => {
    const store = createIdempotencyStore(fakeRedis());
    expect(await store.markIfFirst('inbound:whatsapp:wa_1')).toBe(true);
    expect(await store.markIfFirst('inbound:whatsapp:wa_1')).toBe(false);
    expect(await store.markIfFirst('inbound:whatsapp:wa_1')).toBe(false);
  });

  it('treats distinct keys independently', async () => {
    const store = createIdempotencyStore(fakeRedis());
    expect(await store.markIfFirst('a')).toBe(true);
    expect(await store.markIfFirst('b')).toBe(true);
  });

  it('reports whether a key has been seen', async () => {
    const store = createIdempotencyStore(fakeRedis());
    expect(await store.seen('k')).toBe(false);
    await store.markIfFirst('k');
    expect(await store.seen('k')).toBe(true);
  });
});
