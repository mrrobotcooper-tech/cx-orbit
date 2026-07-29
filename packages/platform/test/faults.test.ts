import { describe, expect, it } from 'vitest';
import type { Redis } from 'ioredis';
import { createFaultStore, FAULT_KEYS } from '../src/index.js';

function fakeRedis(): Redis & { store: Map<string, string> } {
  const store = new Map<string, string>();
  const fake = {
    store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, ...args: unknown[]) {
      // Support SET key value and SET key value EX ttl
      if (args[0] === 'EX' && typeof args[1] === 'number') {
        store.set(key, value);
        return 'OK';
      }
      store.set(key, value);
      return 'OK';
    },
    async del(...keys: string[]) {
      let n = 0;
      for (const k of keys) {
        if (store.delete(k)) n += 1;
      }
      return n;
    },
    async keys(pattern: string) {
      const prefix = pattern.replace(/\*$/, '');
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    },
  };
  return fake as unknown as Redis & { store: Map<string, string> };
}

describe('fault store', () => {
  it('sets and clears fault flags under the platform prefix', async () => {
    const redis = fakeRedis();
    const faults = createFaultStore(redis);

    await faults.set(FAULT_KEYS.AI_FORCE_FAILURE, 'INVALID_JSON');
    expect(await faults.get(FAULT_KEYS.AI_FORCE_FAILURE)).toBe('INVALID_JSON');
    expect(redis.store.has('cxorbit:fault:ai_force_failure')).toBe(true);

    await faults.del(FAULT_KEYS.AI_FORCE_FAILURE);
    expect(await faults.get(FAULT_KEYS.AI_FORCE_FAILURE)).toBeNull();
  });

  it('clearAll removes every fault key', async () => {
    const redis = fakeRedis();
    const faults = createFaultStore(redis);
    await faults.set(FAULT_KEYS.OUTBOX_DROP, '1');
    await faults.set(FAULT_KEYS.DB_LATENCY_MS, '500');
    await faults.clearAll();
    expect(await faults.get(FAULT_KEYS.OUTBOX_DROP)).toBeNull();
    expect(await faults.get(FAULT_KEYS.DB_LATENCY_MS)).toBeNull();
  });
});
