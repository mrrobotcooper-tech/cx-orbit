import { FAULT_KEYS, Registry, type FaultStore } from '@cx-orbit/platform';
import { createLogger } from '@cx-orbit/platform';
import { type AnyEvent, createEvent } from '@cx-orbit/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Collections } from '../src/db/collections.js';
import type { OutboxDoc } from '../src/domain/types.js';
import { createConversationMetrics } from '../src/metrics.js';
import { createOutboxRelay } from '../src/outbox/relay.js';

const logger = createLogger({ service: 'relay-test', level: 'silent' });

function memoryFaults(initial: Record<string, string> = {}): FaultStore {
  const store = new Map(Object.entries(initial));
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async del(key) {
      store.delete(key);
    },
    async clearAll() {
      store.clear();
    },
  };
}

/** Minimal in-memory stand-in for the outbox collection used by the relay. */
function fakeOutbox(docs: OutboxDoc[]) {
  const isPending = (filter: Record<string, unknown>, d: OutboxDoc): boolean =>
    filter.status === undefined || d.status === filter.status;

  return {
    find(filter: Record<string, unknown>) {
      let arr = docs.filter((d) => isPending(filter, d));
      const chain = {
        sort() {
          return chain;
        },
        limit(n: number) {
          arr = arr.slice(0, n);
          return chain;
        },
        async toArray() {
          return arr;
        },
      };
      return chain;
    },
    async updateOne(filter: { _id: string }, update: Record<string, Record<string, unknown>>) {
      const d = docs.find((x) => x._id === filter._id);
      if (!d) return { matchedCount: 0 };
      if (update.$set) Object.assign(d, update.$set);
      if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          (d as unknown as Record<string, number>)[k] =
            ((d as unknown as Record<string, number>)[k] ?? 0) + (v as number);
        }
      }
      return { matchedCount: 1 };
    },
    async countDocuments(filter: Record<string, unknown>) {
      return docs.filter((d) => isPending(filter, d)).length;
    },
  };
}

function fakeBus(published: AnyEvent[]) {
  return {
    async publish(event: AnyEvent) {
      published.push(event);
      return { seq: published.length, duplicate: false };
    },
  };
}

function pendingDoc(id: string): OutboxDoc {
  const event = createEvent({
    eventId: id,
    eventType: 'conversation.created',
    source: 'test',
    payload: { conversationId: 'conv_1', channel: 'webchat', status: 'OPEN' },
  });
  return { _id: id, event, status: 'pending', attempts: 0, createdAt: new Date() };
}

describe('outbox relay', () => {
  let published: AnyEvent[];
  let metrics: ReturnType<typeof createConversationMetrics>;

  beforeEach(() => {
    published = [];
    metrics = createConversationMetrics(new Registry());
  });

  it('publishes pending entries and marks them published', async () => {
    const docs = [pendingDoc('evt_1'), pendingDoc('evt_2')];
    const collections = { outbox: fakeOutbox(docs) } as unknown as Collections;
    const relay = createOutboxRelay(fakeBus(published) as never, collections, metrics, logger);

    const count = await relay.pump();

    expect(count).toBe(2);
    expect(published.map((e) => e.eventId)).toEqual(['evt_1', 'evt_2']);
    expect(docs.every((d) => d.status === 'published')).toBe(true);
    expect(docs.every((d) => d.attempts === 1)).toBe(true);
  });

  it('does not republish already-published entries', async () => {
    const docs = [pendingDoc('evt_1')];
    const collections = { outbox: fakeOutbox(docs) } as unknown as Collections;
    const relay = createOutboxRelay(fakeBus(published) as never, collections, metrics, logger);

    await relay.pump();
    const second = await relay.pump();

    expect(second).toBe(0);
    expect(published).toHaveLength(1);
  });

  it('skips publish while OUTBOX_DROP fault is active (INC-006)', async () => {
    const docs = [pendingDoc('evt_drop')];
    const collections = { outbox: fakeOutbox(docs) } as unknown as Collections;
    const faults = memoryFaults({ [FAULT_KEYS.OUTBOX_DROP]: '1' });
    const relay = createOutboxRelay(fakeBus(published) as never, collections, metrics, logger, {
      faults,
    });

    const count = await relay.pump();
    expect(count).toBe(0);
    expect(published).toHaveLength(0);
    expect(docs[0]?.status).toBe('pending');
  });

  it('retries later after a publish failure (event retry)', async () => {
    const docs = [pendingDoc('evt_retry')];
    const collections = { outbox: fakeOutbox(docs) } as unknown as Collections;
    let attempts = 0;
    const flakyBus = {
      async publish(event: AnyEvent) {
        attempts += 1;
        if (attempts === 1) throw new Error('nats unavailable');
        published.push(event);
        return { seq: published.length, duplicate: false };
      },
    };
    const relay = createOutboxRelay(flakyBus as never, collections, metrics, logger);

    expect(await relay.pump()).toBe(0);
    expect(docs[0]?.status).toBe('pending');
    expect(docs[0]?.attempts).toBe(1);

    expect(await relay.pump()).toBe(1);
    expect(docs[0]?.status).toBe('published');
    expect(published).toHaveLength(1);
  });
});
