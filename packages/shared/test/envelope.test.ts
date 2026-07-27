import { describe, expect, it } from 'vitest';
import { EventEnvelopeBaseSchema } from '../src/index.js';

const validBase = {
  eventId: 'evt_1',
  eventType: 'message.received',
  version: 1,
  occurredAt: '2026-07-25T12:00:00.000Z',
  correlationId: 'corr_1',
  traceId: 'trace_1',
  source: 'channel-gateway',
  payload: {},
};

describe('EventEnvelopeBaseSchema', () => {
  it('accepts a well-formed envelope', () => {
    expect(EventEnvelopeBaseSchema.safeParse(validBase).success).toBe(true);
  });

  it('rejects an unknown event type', () => {
    expect(
      EventEnvelopeBaseSchema.safeParse({ ...validBase, eventType: 'nope.happened' }).success,
    ).toBe(false);
  });

  it('rejects a non-ISO occurredAt', () => {
    expect(
      EventEnvelopeBaseSchema.safeParse({ ...validBase, occurredAt: 'not-a-date' }).success,
    ).toBe(false);
  });

  it('rejects a non-positive version', () => {
    expect(EventEnvelopeBaseSchema.safeParse({ ...validBase, version: 0 }).success).toBe(false);
    expect(EventEnvelopeBaseSchema.safeParse({ ...validBase, version: 1.5 }).success).toBe(false);
  });

  it.each(['eventId', 'correlationId', 'traceId', 'source'])('rejects a missing %s', (field) => {
    const clone: Record<string, unknown> = { ...validBase };
    delete clone[field];
    expect(EventEnvelopeBaseSchema.safeParse(clone).success).toBe(false);
  });
});
