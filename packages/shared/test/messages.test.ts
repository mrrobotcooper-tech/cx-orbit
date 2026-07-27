import { describe, expect, it } from 'vitest';
import { CanonicalInboundMessageSchema, MessageContentSchema } from '../src/index.js';

describe('MessageContentSchema', () => {
  it('accepts a non-empty text message', () => {
    const parsed = MessageContentSchema.parse({ type: 'text', text: 'hola' });
    expect(parsed).toEqual({ type: 'text', text: 'hola' });
  });

  it('rejects a text message with empty text', () => {
    expect(MessageContentSchema.safeParse({ type: 'text', text: '   ' }).success).toBe(false);
    expect(MessageContentSchema.safeParse({ type: 'text' }).success).toBe(false);
  });

  it('requires a mediaUrl for media content', () => {
    expect(MessageContentSchema.safeParse({ type: 'image' }).success).toBe(false);
    expect(
      MessageContentSchema.safeParse({ type: 'image', mediaUrl: 'https://x/y.png' }).success,
    ).toBe(true);
  });
});

describe('CanonicalInboundMessageSchema', () => {
  const valid = {
    channel: 'whatsapp',
    externalMessageId: 'wa_msg_123',
    externalConversationId: 'wa_conv_123',
    sender: { externalId: '+5491112345678', displayName: 'Customer' },
    content: { type: 'text', text: 'No puedo pagar mi factura' },
  };

  it('parses a valid canonical message', () => {
    expect(CanonicalInboundMessageSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unknown channel', () => {
    expect(CanonicalInboundMessageSchema.safeParse({ ...valid, channel: 'sms' }).success).toBe(
      false,
    );
  });

  it('rejects a missing externalMessageId', () => {
    const withoutId: Record<string, unknown> = { ...valid };
    delete withoutId.externalMessageId;
    expect(CanonicalInboundMessageSchema.safeParse(withoutId).success).toBe(false);
  });

  it('requires a sender externalId', () => {
    expect(
      CanonicalInboundMessageSchema.safeParse({ ...valid, sender: { displayName: 'x' } }).success,
    ).toBe(false);
  });
});
