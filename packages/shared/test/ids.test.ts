import { describe, expect, it } from 'vitest';
import {
  inboundIdempotencyKey,
  newConversationId,
  newCorrelationId,
  newEventId,
  newSpanId,
  newTraceId,
} from '../src/index.js';

describe('id generators', () => {
  it('produce prefixed identifiers', () => {
    expect(newEventId()).toMatch(/^evt_[0-9a-f-]{36}$/);
    expect(newCorrelationId()).toMatch(/^corr_[0-9a-f-]{36}$/);
    expect(newConversationId()).toMatch(/^conv_[0-9a-f-]{36}$/);
  });

  it('produce OTel-compatible trace and span ids', () => {
    expect(newTraceId()).toMatch(/^[0-9a-f]{32}$/);
    expect(newSpanId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it('generate unique values', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newEventId()));
    expect(ids.size).toBe(1000);
  });

  it('build a deterministic inbound idempotency key', () => {
    expect(inboundIdempotencyKey('whatsapp', 'wa_msg_1')).toBe('inbound:whatsapp:wa_msg_1');
    expect(inboundIdempotencyKey('whatsapp', 'wa_msg_1')).toBe(
      inboundIdempotencyKey('whatsapp', 'wa_msg_1'),
    );
  });
});
