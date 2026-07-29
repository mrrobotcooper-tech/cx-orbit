import type { EventBus, IdempotencyStore } from '@cx-orbit/platform';
import { createLogger, Registry } from '@cx-orbit/platform';
import type { AnyEvent } from '@cx-orbit/shared';
import { createEvent } from '@cx-orbit/shared';
import { describe, expect, it, vi } from 'vitest';
import type { OutboundAdapter } from '../src/adapters/types.js';
import { ProviderDeliveryError } from '../src/adapters/types.js';
import type { DeadLetterEntry, DeadLetterQueue } from '../src/dlq.js';
import { createOutboundMetrics } from '../src/metrics.js';
import { createDeliveryService } from '../src/service/delivery-service.js';

const logger = createLogger({ service: 'outbound-fail-test', level: 'silent' });

/**
 * Phase 12 failure suite — provider timeout leads to retries then failure event / DLQ path.
 */
describe('failure: provider timeout (INC-002)', () => {
  it('retries TIMEOUT then emits delivery.failed', async () => {
    const published: AnyEvent[] = [];
    const keys = new Set<string>();
    const idempotency: IdempotencyStore = {
      async markIfFirst(key) {
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
      },
      async seen(key) {
        return keys.has(key);
      },
    };
    const entries: DeadLetterEntry[] = [];
    const dlq: DeadLetterQueue = {
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
    const sendMessage = vi
      .fn()
      .mockRejectedValue(new ProviderDeliveryError('timeout', 'TIMEOUT', true));
    const adapter: OutboundAdapter = { channel: 'webchat', sendMessage };

    const service = createDeliveryService({
      adapters: { webchat: adapter } as never,
      bus: {
        publish: async (e: AnyEvent) => {
          published.push(e);
          return { seq: published.length, duplicate: false };
        },
      } as unknown as EventBus,
      idempotency,
      dlq,
      metrics: createOutboundMetrics(new Registry()),
      logger,
      maxRetries: 3,
      baseBackoffMs: 1,
      timeoutMs: 200,
      breakerFailureThreshold: 0.9,
      breakerMinRequests: 100,
      breakerResetMs: 15_000,
    });

    const event = createEvent({
      eventType: 'message.send.requested',
      source: 'test',
      payload: {
        conversationId: 'conv_1',
        channel: 'webchat',
        recipientExternalId: 'user_1',
        content: { type: 'text', text: 'hola' },
        idempotencyKey: `send_fail_${Date.now()}`,
      },
    });

    const result = await service.handleSendRequested(event);
    expect(result.status).toBe('failed');
    expect(sendMessage.mock.calls.length).toBe(3);
    expect(entries).toHaveLength(1);
    expect(published.some((e) => e.eventType === 'message.delivery.failed')).toBe(true);
  });
});
