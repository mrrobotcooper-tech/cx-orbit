import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFaultStore,
  createIdempotencyStore,
  createRedis,
  FAULT_KEYS,
  type Redis,
} from '../src/index.js';

/**
 * Live Redis integration. Opt-in:
 *   RUN_INTEGRATION=1 pnpm --filter @cx-orbit/platform test:integration
 */
const RUN = process.env.RUN_INTEGRATION === '1';
const suite = RUN ? describe : describe.skip;
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

suite('platform redis integration', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = createRedis({ url: REDIS_URL, keyPrefix: 'cxorbit:it:' });
  });

  afterAll(() => {
    redis.disconnect();
  });

  it('idempotency store dedupes with real Redis NX', async () => {
    const store = createIdempotencyStore(redis, { defaultTtlSeconds: 60 });
    const key = `idem:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    expect(await store.markIfFirst(key)).toBe(true);
    expect(await store.markIfFirst(key)).toBe(false);
    expect(await store.seen(key)).toBe(true);
  });

  it('fault store round-trips on real Redis', async () => {
    const faults = createFaultStore(redis);
    const value = `v_${Date.now()}`;
    await faults.set(FAULT_KEYS.WEBCHAT_SIMULATE, value);
    expect(await faults.get(FAULT_KEYS.WEBCHAT_SIMULATE)).toBe(value);
    await faults.del(FAULT_KEYS.WEBCHAT_SIMULATE);
    expect(await faults.get(FAULT_KEYS.WEBCHAT_SIMULATE)).toBeNull();
  });
});
