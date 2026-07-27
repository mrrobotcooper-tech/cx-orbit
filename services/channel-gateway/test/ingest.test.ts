import { Registry } from '@cx-orbit/platform';
import { EventValidationError } from '@cx-orbit/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createWebChatAdapter } from '../src/adapters/webchat.js';
import { createIngestService } from '../src/ingest.js';
import { createGatewayMetrics, type GatewayMetrics } from '../src/metrics.js';
import { createFakeIdempotency, createFakePublisher } from './helpers.js';

const ctx = { correlationId: 'corr_test', traceId: 'trace_test' };
const adapter = createWebChatAdapter();

function validPayload(messageId: string) {
  return {
    sessionId: 'sess_1',
    messageId,
    from: { id: 'visitor_1', name: 'Ana' },
    text: 'hola',
  };
}

describe('ingest pipeline', () => {
  let metrics: GatewayMetrics;

  beforeEach(() => {
    metrics = createGatewayMetrics(new Registry());
  });

  it('publishes message.received for the first delivery', async () => {
    const publisher = createFakePublisher();
    const ingest = createIngestService({
      publisher,
      idempotency: createFakeIdempotency(),
      metrics,
    });

    const result = await ingest.ingest(adapter, validPayload('wc_1'), ctx);

    expect(result.status).toBe('accepted');
    expect(result.eventId).toBeDefined();
    expect(publisher.published).toHaveLength(1);
    const [event] = publisher.published;
    expect(event?.eventType).toBe('message.received');
    expect(event?.correlationId).toBe('corr_test');
    expect(event?.traceId).toBe('trace_test');
  });

  it('deduplicates repeated deliveries of the same external message', async () => {
    const publisher = createFakePublisher();
    const idempotency = createFakeIdempotency();
    const ingest = createIngestService({ publisher, idempotency, metrics });

    const first = await ingest.ingest(adapter, validPayload('wc_dup'), ctx);
    const second = await ingest.ingest(adapter, validPayload('wc_dup'), ctx);

    expect(first.status).toBe('accepted');
    expect(second.status).toBe('duplicate');
    expect(second.eventId).toBeUndefined();
    expect(publisher.published).toHaveLength(1);
  });

  it('rejects payloads that fail canonical validation (empty text)', async () => {
    const publisher = createFakePublisher();
    const ingest = createIngestService({
      publisher,
      idempotency: createFakeIdempotency(),
      metrics,
    });

    await expect(
      ingest.ingest(
        adapter,
        { sessionId: 's', messageId: 'wc_x', from: { id: 'v' }, text: '   ' },
        ctx,
      ),
    ).rejects.toBeInstanceOf(EventValidationError);
    expect(publisher.published).toHaveLength(0);
  });
});
