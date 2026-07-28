import type { EventBus, IdempotencyStore } from '@cx-orbit/platform';
import { createCircuitBreaker, createLogger, Registry } from '@cx-orbit/platform';
import type { AnyEvent } from '@cx-orbit/shared';
import { createEvent } from '@cx-orbit/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboundAdapter } from '../src/adapters/types.js';
import { ProviderDeliveryError } from '../src/adapters/types.js';
import type { DeadLetterQueue, DeadLetterEntry } from '../src/dlq.js';
import { createOutboundMetrics } from '../src/metrics.js';
import { createDeliveryService } from '../src/service/delivery-service.js';

const logger = createLogger({ service: 'outbound-test', level: 'silent' });

function fakeIdempotency(): IdempotencyStore {
  const keys = new Set<string>();
  return {
    async markIfFirst(key) {
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    },
    async seen(key) {
      return keys.has(key);
    },
  };
}

function fakeBus(published: AnyEvent[]): EventBus {
  const publish = async (event: AnyEvent) => {
    published.push(event);
    return { seq: published.length, duplicate: false };
  };
  return { publish } as unknown as EventBus;
}

function fakeDlq(): DeadLetterQueue & { entries: DeadLetterEntry[] } {
  const entries: DeadLetterEntry[] = [];
  return {
    entries,
    async push(e) {
      entries.push(e);
    },
    async list() {
      return entries;
    },
    async size() {
      return entries.length;
    },
  };
}

function sendEvent(idempotencyKey: string) {
  return createEvent({
    eventType: 'message.send.requested',
    source: 'test',
    payload: {
      conversationId: 'conv_1',
      channel: 'webchat',
      recipientExternalId: 'visitor_1',
      content: { type: 'text', text: 'hola' },
      idempotencyKey,
    },
  });
}

describe('delivery service', () => {
  let published: AnyEvent[];
  let dlq: ReturnType<typeof fakeDlq>;

  beforeEach(() => {
    published = [];
    dlq = fakeDlq();
  });

  it('delivers successfully and publishes message.sent', async () => {
    const adapter: OutboundAdapter = {
      channel: 'webchat',
      sendMessage: vi.fn().mockResolvedValue({ providerMessageId: 'p1', attempts: 1 }),
    };
    const service = createDeliveryService({
      adapters: { webchat: adapter } as never,
      bus: fakeBus(published),
      idempotency: fakeIdempotency(),
      dlq,
      metrics: createOutboundMetrics(new Registry()),
      logger,
      maxRetries: 3,
      baseBackoffMs: 1,
      timeoutMs: 1000,
      breakerFailureThreshold: 0.5,
      breakerMinRequests: 10,
      breakerResetMs: 15_000,
    });

    const result = await service.handleSendRequested(sendEvent('key_ok'));
    expect(result.status).toBe('sent');
    expect(published.some((e) => e.eventType === 'message.sent')).toBe(true);
    expect(dlq.entries).toHaveLength(0);
  });

  it('retries then succeeds', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new ProviderDeliveryError('tmp', 'PROVIDER_ERROR', true))
      .mockResolvedValue({ providerMessageId: 'p2', attempts: 1 });
    const service = createDeliveryService({
      adapters: { webchat: { channel: 'webchat', sendMessage } } as never,
      bus: fakeBus(published),
      idempotency: fakeIdempotency(),
      dlq,
      metrics: createOutboundMetrics(new Registry()),
      logger,
      maxRetries: 4,
      baseBackoffMs: 1,
      timeoutMs: 1000,
      breakerFailureThreshold: 0.9,
      breakerMinRequests: 100,
      breakerResetMs: 15_000,
    });

    const result = await service.handleSendRequested(sendEvent('key_retry'));
    expect(result.status).toBe('sent');
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('dead-letters after exhausting retries', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(new ProviderDeliveryError('down', 'PROVIDER_ERROR', true));
    const service = createDeliveryService({
      adapters: { webchat: { channel: 'webchat', sendMessage } } as never,
      bus: fakeBus(published),
      idempotency: fakeIdempotency(),
      dlq,
      metrics: createOutboundMetrics(new Registry()),
      logger,
      maxRetries: 3,
      baseBackoffMs: 1,
      timeoutMs: 500,
      breakerFailureThreshold: 0.9,
      breakerMinRequests: 100,
      breakerResetMs: 15_000,
    });

    const result = await service.handleSendRequested(sendEvent('key_fail'));
    expect(result.status).toBe('failed');
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(dlq.entries).toHaveLength(1);
    expect(published.some((e) => e.eventType === 'message.delivery.failed')).toBe(true);
  });

  it('does not retry non-retryable errors', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(new ProviderDeliveryError('bad', 'INVALID_RECIPIENT', false));
    const service = createDeliveryService({
      adapters: { webchat: { channel: 'webchat', sendMessage } } as never,
      bus: fakeBus(published),
      idempotency: fakeIdempotency(),
      dlq,
      metrics: createOutboundMetrics(new Registry()),
      logger,
      maxRetries: 5,
      baseBackoffMs: 1,
      timeoutMs: 500,
      breakerFailureThreshold: 0.9,
      breakerMinRequests: 100,
      breakerResetMs: 15_000,
    });

    await service.handleSendRequested(sendEvent('key_bad'));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(dlq.entries[0]?.reason).toBe('INVALID_RECIPIENT');
  });
});

describe('circuit breaker export smoke', () => {
  it('createCircuitBreaker is usable', async () => {
    const b = createCircuitBreaker('webchat', { minRequests: 2, failureThreshold: 0.5 });
    await expect(b.exec(async () => Promise.reject(new Error('x')))).rejects.toThrow();
    await expect(b.exec(async () => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(b.getState()).toBe('OPEN');
  });
});
