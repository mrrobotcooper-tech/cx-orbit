import type { EventBus, IdempotencyStore } from '@cx-orbit/platform';
import { createLogger, Registry } from '@cx-orbit/platform';
import type { AnyEvent } from '@cx-orbit/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAiMetrics } from '../src/metrics.js';
import { createMockAIProvider } from '../src/providers/mock.js';
import { createAnalysisService } from '../src/service/analysis-service.js';

const logger = createLogger({ service: 'ai-test', level: 'silent' });

function fakeIdempotency(): IdempotencyStore {
  const keys = new Set<string>();
  return {
    async markIfFirst(key: string) {
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    },
    async seen(key: string) {
      return keys.has(key);
    },
  };
}

function fakeBus(published: AnyEvent[]): EventBus {
  const publish = async (event: AnyEvent): Promise<{ seq: number; duplicate: boolean }> => {
    published.push(event);
    return { seq: published.length, duplicate: false };
  };
  return { publish } as unknown as EventBus;
}

describe('analysis service', () => {
  let published: AnyEvent[];
  let metrics: ReturnType<typeof createAiMetrics>;

  beforeEach(() => {
    published = [];
    metrics = createAiMetrics(new Registry());
  });

  it('publishes ai.analysis.completed on success', async () => {
    const service = createAnalysisService({
      provider: createMockAIProvider(),
      bus: fakeBus(published),
      idempotency: fakeIdempotency(),
      metrics,
      logger,
      minConfidence: 0.7,
      timeoutMs: 2000,
    });

    const result = await service.analyzeAndPublish(
      {
        text: 'Hola, problema con mi factura ORD-9',
        conversationId: 'conv_1',
        messageId: 'msg_1',
      },
      { correlationId: 'corr_1', traceId: 'trace_1' },
    );

    expect(result.status).toBe('ok');
    expect(result.bundle?.intent.intent).toBe('billing');
    expect(published).toHaveLength(1);
    expect(published[0]?.eventType).toBe('ai.analysis.completed');
  });

  it('deduplicates repeated analyses for the same message', async () => {
    const service = createAnalysisService({
      provider: createMockAIProvider(),
      bus: fakeBus(published),
      idempotency: fakeIdempotency(),
      metrics,
      logger,
      minConfidence: 0.7,
      timeoutMs: 2000,
    });
    const input = { text: 'hola', conversationId: 'conv_1', messageId: 'msg_dup' };
    const trace = { correlationId: 'c', traceId: 't' };

    expect((await service.analyzeAndPublish(input, trace)).status).toBe('ok');
    expect((await service.analyzeAndPublish(input, trace)).status).toBe('duplicate');
    expect(published).toHaveLength(1);
  });

  it('uses fallback and still publishes when INVALID_JSON is forced', async () => {
    const service = createAnalysisService({
      provider: createMockAIProvider({ forceFailure: 'INVALID_JSON' }),
      bus: fakeBus(published),
      idempotency: fakeIdempotency(),
      metrics,
      logger,
      minConfidence: 0.7,
      timeoutMs: 2000,
    });

    const result = await service.analyzeAndPublish(
      { text: 'hola', conversationId: 'conv_x', messageId: 'msg_x' },
      { correlationId: 'c', traceId: 't' },
    );

    expect(result.status).toBe('fallback');
    expect(result.usedFallback).toBe(true);
    expect(result.bundle?.intent.intent).toBe('unknown');
    expect(published[0]?.eventType).toBe('ai.analysis.completed');
    if (published[0]?.eventType === 'ai.analysis.completed') {
      expect(published[0].payload.confidence).toBe(0);
    }
  });

  it('skips conversation.updated without inbound text', async () => {
    const service = createAnalysisService({
      provider: createMockAIProvider(),
      bus: fakeBus(published),
      idempotency: fakeIdempotency(),
      metrics,
      logger,
      minConfidence: 0.7,
      timeoutMs: 2000,
    });

    const result = await service.handleConversationUpdated({
      eventId: 'evt_1',
      eventType: 'conversation.updated',
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: 'c',
      traceId: 't',
      source: 'test',
      payload: { conversationId: 'conv_1', changes: { direction: 'outbound' } },
    });

    expect(result.status).toBe('skipped');
    expect(published).toHaveLength(0);
  });

  it('analyzes inbound conversation.updated with text', async () => {
    const service = createAnalysisService({
      provider: createMockAIProvider(),
      bus: fakeBus(published),
      idempotency: fakeIdempotency(),
      metrics,
      logger,
      minConfidence: 0.7,
      timeoutMs: 2000,
    });

    const result = await service.handleConversationUpdated({
      eventId: 'evt_2',
      eventType: 'conversation.updated',
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: 'c',
      traceId: 't',
      source: 'test',
      payload: {
        conversationId: 'conv_2',
        changes: { direction: 'inbound', text: 'necesito ayuda', lastMessageId: 'msg_9' },
      },
    });

    expect(result.status).toBe('ok');
    expect(result.bundle?.intent.intent).toBe('support');
  });
});
