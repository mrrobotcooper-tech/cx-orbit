import {
  FAULT_KEYS,
  Registry,
  type EventBus,
  type FaultStore,
} from '@cx-orbit/platform';
import type { AnyEvent } from '@cx-orbit/shared';
import { describe, expect, it, vi } from 'vitest';
import { createIncidentEngine } from '../src/engine.js';
import { createIncidentMetrics } from '../src/metrics.js';

function memoryFaults(): FaultStore & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
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

function fakeBus(): EventBus & { events: AnyEvent[] } {
  const events: AnyEvent[] = [];
  return {
    events,
    connection: { isClosed: () => false } as EventBus['connection'],
    js: {} as EventBus['js'],
    jsm: {} as EventBus['jsm'],
    streamName: 'CXORBIT',
    async publish(event) {
      events.push(event);
      return { seq: events.length, duplicate: false };
    },
    async close() {
      /* noop */
    },
  };
}

function logger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => logger(),
  };
}

function makeEngine(faults = memoryFaults(), bus = fakeBus()) {
  const metrics = createIncidentMetrics(new Registry());
  const engine = createIncidentEngine({
    bus,
    faults,
    metrics,
    logger: logger() as never,
    defaults: { queueBacklogCount: 3, dbLatencyMs: 1500 },
  });
  return { engine, faults, bus, metrics };
}

describe('incident engine', () => {
  it('lists Phase 10 catalog', () => {
    const { engine } = makeEngine();
    const catalog = engine.catalog();
    expect(catalog).toHaveLength(6);
    expect(catalog.map((c) => c.code)).toEqual([
      'INC-001',
      'INC-002',
      'INC-003',
      'INC-004',
      'INC-005',
      'INC-006',
    ]);
  });

  it('INC-001 publishes duplicate message.received then incident.started', async () => {
    const { engine, bus } = makeEngine();
    const incident = await engine.start({
      code: 'INC-001',
      params: { externalMessageId: 'dup_test_1', rounds: 1 },
    });
    expect(incident.type).toBe('DUPLICATE_MESSAGES');
    const received = bus.events.filter((e) => e.eventType === 'message.received');
    expect(received).toHaveLength(2);
    expect(received[0]?.payload).toMatchObject({ externalMessageId: 'dup_test_1' });
    expect(received[1]?.payload).toMatchObject({ externalMessageId: 'dup_test_1' });
    expect(bus.events.some((e) => e.eventType === 'incident.started')).toBe(true);
    await engine.stop(incident.incidentId);
    expect(bus.events.some((e) => e.eventType === 'incident.ended')).toBe(true);
  });

  it('INC-002 sets and clears webchat timeout fault', async () => {
    const { engine, faults } = makeEngine();
    const incident = await engine.start({ type: 'PROVIDER_TIMEOUT' });
    expect(await faults.get(FAULT_KEYS.WEBCHAT_SIMULATE)).toBe('timeout');
    await engine.stop(incident.incidentId);
    expect(await faults.get(FAULT_KEYS.WEBCHAT_SIMULATE)).toBeNull();
  });

  it('INC-003 floods message.received with default count', async () => {
    const { engine, bus } = makeEngine();
    const incident = await engine.start({ type: 'QUEUE_BACKLOG' });
    const received = bus.events.filter((e) => e.eventType === 'message.received');
    expect(received).toHaveLength(3);
    await engine.stop(incident.incidentId);
  });

  it('INC-004 / INC-005 / INC-006 set Redis fault flags', async () => {
    const { engine, faults } = makeEngine();

    const lat = await engine.start({ type: 'DATABASE_LATENCY', params: { latencyMs: 900 } });
    expect(await faults.get(FAULT_KEYS.DB_LATENCY_MS)).toBe('900');
    await engine.stop(lat.incidentId);

    const ai = await engine.start({ code: 'INC-005' });
    expect(await faults.get(FAULT_KEYS.AI_FORCE_FAILURE)).toBe('INVALID_JSON');
    await engine.stop(ai.incidentId);

    const loss = await engine.start({ type: 'EVENT_LOSS' });
    expect(await faults.get(FAULT_KEYS.OUTBOX_DROP)).toBe('1');
    await engine.stop(loss.incidentId);
    expect(await faults.get(FAULT_KEYS.OUTBOX_DROP)).toBeNull();
  });

  it('rejects duplicate active incident of same type', async () => {
    const { engine } = makeEngine();
    await engine.start({ type: 'PROVIDER_TIMEOUT' });
    await expect(engine.start({ type: 'PROVIDER_TIMEOUT' })).rejects.toMatchObject({
      statusCode: 409,
    });
    await engine.stopAll();
  });
});
