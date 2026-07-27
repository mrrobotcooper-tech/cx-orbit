import { describe, expect, it } from 'vitest';
import {
  CURRENT_EVENT_VERSION,
  EVENT_TYPES,
  EventValidationError,
  UnknownEventError,
  createEvent,
  eventPayloadRegistry,
  isEventType,
  parseEvent,
  safeParseEvent,
  type MessageReceivedPayload,
} from '../src/index.js';

const sampleInbound: MessageReceivedPayload = {
  channel: 'whatsapp',
  externalMessageId: 'wa_msg_123',
  externalConversationId: 'wa_conv_123',
  sender: { externalId: '+5491112345678', displayName: 'Customer' },
  content: { type: 'text', text: 'No puedo pagar mi factura' },
};

describe('event registry completeness', () => {
  it('registers a v1 schema for every event type', () => {
    for (const type of EVENT_TYPES) {
      const versions = eventPayloadRegistry[type];
      expect(versions, `missing registry entry for ${type}`).toBeDefined();
      expect(versions[CURRENT_EVENT_VERSION], `missing v1 schema for ${type}`).toBeDefined();
    }
  });

  it('isEventType recognizes known and unknown types', () => {
    expect(isEventType('message.received')).toBe(true);
    expect(isEventType('totally.made.up')).toBe(false);
  });
});

describe('createEvent', () => {
  it('populates ids, timestamp and validates the payload', () => {
    const event = createEvent({
      eventType: 'message.received',
      payload: sampleInbound,
      source: 'channel-gateway',
    });

    expect(event.eventType).toBe('message.received');
    expect(event.version).toBe(CURRENT_EVENT_VERSION);
    expect(event.eventId).toMatch(/^evt_/);
    expect(event.correlationId).toMatch(/^corr_/);
    expect(event.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(() => new Date(event.occurredAt).toISOString()).not.toThrow();
    expect(event.payload.externalMessageId).toBe('wa_msg_123');
  });

  it('honors provided correlation and trace ids', () => {
    const event = createEvent({
      eventType: 'message.received',
      payload: sampleInbound,
      source: 'channel-gateway',
      correlationId: 'corr_fixed',
      traceId: 'trace_fixed',
    });
    expect(event.correlationId).toBe('corr_fixed');
    expect(event.traceId).toBe('trace_fixed');
  });

  it('throws EventValidationError on an invalid payload', () => {
    expect(() =>
      createEvent({
        eventType: 'ai.analysis.completed',
        // confidence out of range
        payload: {
          conversationId: 'conv_1',
          intent: 'billing',
          sentiment: 'negative',
          confidence: 5,
        },
        source: 'ai-service',
      }),
    ).toThrow(EventValidationError);
  });
});

describe('parseEvent', () => {
  it('round-trips a created event', () => {
    const event = createEvent({
      eventType: 'routing.completed',
      payload: {
        conversationId: 'conv_1',
        assignedTeam: 'billing',
        priority: 4,
        reason: ['intent=billing', 'sentiment=negative'],
      },
      source: 'routing-service',
    });

    const parsed = parseEvent(event);
    expect(parsed).toEqual(event);
    if (parsed.eventType === 'routing.completed') {
      expect(parsed.payload.assignedTeam).toBe('billing');
    }
  });

  it('throws UnknownEventError for an unregistered version', () => {
    const raw = {
      eventId: 'evt_1',
      eventType: 'message.received',
      version: 99,
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_1',
      traceId: 'trace_1',
      source: 'test',
      payload: sampleInbound,
    };
    expect(() => parseEvent(raw)).toThrow(UnknownEventError);
  });

  it('throws EventValidationError for a bad payload', () => {
    const raw = {
      eventId: 'evt_1',
      eventType: 'message.received',
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: 'corr_1',
      traceId: 'trace_1',
      source: 'test',
      payload: { channel: 'whatsapp' },
    };
    expect(() => parseEvent(raw)).toThrow(EventValidationError);
  });

  it('safeParseEvent reports failure without throwing', () => {
    const result = safeParseEvent({ eventType: 'message.received' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});
