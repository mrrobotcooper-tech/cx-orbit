import { createLogger, Registry } from '@cx-orbit/platform';
import { createEvent } from '@cx-orbit/shared';
import { describe, expect, it } from 'vitest';
import { createAggregator } from '../src/aggregator.js';
import { createAnalyticsMetrics } from '../src/metrics.js';

const logger = createLogger({ service: 'analytics-test', level: 'silent' });
void logger;

function aggregator() {
  return createAggregator(createAnalyticsMetrics(new Registry()));
}

describe('analytics aggregator', () => {
  it('counts inbound messages and conversations', () => {
    const a = aggregator();
    a.recordEvent(
      createEvent({
        eventType: 'message.received',
        source: 'test',
        payload: {
          channel: 'webchat',
          externalMessageId: 'm1',
          sender: { externalId: 'v1' },
          content: { type: 'text', text: 'hola' },
        },
      }),
    );
    a.recordEvent(
      createEvent({
        eventType: 'conversation.created',
        source: 'test',
        payload: { conversationId: 'c1', channel: 'webchat', status: 'OPEN' },
      }),
    );
    const snap = a.snapshot();
    expect(snap.messagesInbound).toBe(1);
    expect(snap.conversationsCreated).toBe(1);
    expect(snap.eventsByType['message.received']).toBe(1);
  });

  it('tracks AI low confidence and routing handoffs', () => {
    const a = aggregator();
    a.recordEvent(
      createEvent({
        eventType: 'ai.analysis.completed',
        source: 'test',
        payload: {
          conversationId: 'c1',
          intent: 'unknown',
          sentiment: 'neutral',
          confidence: 0.1,
        },
      }),
    );
    a.recordEvent(
      createEvent({
        eventType: 'routing.completed',
        source: 'test',
        payload: {
          conversationId: 'c1',
          assignedTeam: 'general',
          priority: 5,
          reason: ['handoff'],
          handoffToHuman: true,
          handoffReason: 'LOW_AI_CONFIDENCE',
        },
      }),
    );
    const snap = a.snapshot();
    expect(snap.aiAnalyses).toBe(1);
    expect(snap.aiLowConfidence).toBe(1);
    expect(snap.routingDecisions).toBe(1);
    expect(snap.routingHandoffs).toBe(1);
  });

  it('tracks outbound success and failure', () => {
    const a = aggregator();
    a.recordEvent(
      createEvent({
        eventType: 'message.sent',
        source: 'test',
        payload: {
          conversationId: 'c1',
          channel: 'webchat',
          idempotencyKey: 'k1',
          attempts: 1,
        },
      }),
    );
    a.recordEvent(
      createEvent({
        eventType: 'message.delivery.failed',
        source: 'test',
        payload: {
          conversationId: 'c2',
          channel: 'webchat',
          idempotencyKey: 'k2',
          reason: 'TIMEOUT',
          attempts: 3,
          deadLettered: true,
        },
      }),
    );
    const snap = a.snapshot();
    expect(snap.deliveriesSent).toBe(1);
    expect(snap.deliveriesFailed).toBe(1);
    expect(snap.messagesOutbound).toBe(1);
  });
});
