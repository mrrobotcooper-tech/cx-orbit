import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { createAdapters } from '../src/adapters/index.js';
import { createWebChatAdapter } from '../src/adapters/webchat.js';
import { createWhatsAppAdapter } from '../src/adapters/whatsapp.js';
import { createTelegramAdapter } from '../src/adapters/telegram.js';
import { createXAdapter } from '../src/adapters/x.js';

describe('adapter registry', () => {
  it('provides an adapter for every channel', () => {
    const adapters = createAdapters();
    for (const channel of [
      'webchat',
      'whatsapp',
      'telegram',
      'email',
      'instagram',
      'facebook',
      'x',
    ] as const) {
      expect(adapters[channel].channel).toBe(channel);
    }
  });
});

describe('WebChatAdapter', () => {
  const adapter = createWebChatAdapter();

  it('normalizes a valid payload into a canonical message', async () => {
    const message = await adapter.parseInboundEvent({
      sessionId: 'sess_1',
      messageId: 'wc_1',
      from: { id: 'visitor_1', name: 'Ana' },
      text: 'hola',
    });

    expect(message).toEqual({
      channel: 'webchat',
      externalMessageId: 'wc_1',
      externalConversationId: 'sess_1',
      sender: { externalId: 'visitor_1', displayName: 'Ana' },
      content: { type: 'text', text: 'hola' },
    });
  });

  it('omits displayName when name is absent', async () => {
    const message = await adapter.parseInboundEvent({
      sessionId: 'sess_1',
      messageId: 'wc_2',
      from: { id: 'visitor_1' },
      text: 'hola',
    });
    expect(message.sender).toEqual({ externalId: 'visitor_1' });
  });

  it('throws on malformed payload', async () => {
    await expect(adapter.parseInboundEvent({ messageId: 'x' })).rejects.toBeInstanceOf(ZodError);
  });
});

describe('WhatsAppAdapter', () => {
  const adapter = createWhatsAppAdapter();

  it('maps the Cloud API webhook to a canonical message', async () => {
    const message = await adapter.parseInboundEvent({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ profile: { name: 'Ana' }, wa_id: '5491112345678' }],
                messages: [
                  {
                    from: '5491112345678',
                    id: 'wamid.ABC',
                    type: 'text',
                    text: { body: 'hola' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(message).toEqual({
      channel: 'whatsapp',
      externalMessageId: 'wamid.ABC',
      externalConversationId: '5491112345678',
      sender: { externalId: '+5491112345678', displayName: 'Ana' },
      content: { type: 'text', text: 'hola' },
    });
  });
});

describe('TelegramAdapter', () => {
  it('prefers first_name and stringifies numeric ids', async () => {
    const message = await createTelegramAdapter().parseInboundEvent({
      update_id: 1,
      message: {
        message_id: 42,
        from: { id: 777, first_name: 'Ana', username: 'ana_k' },
        chat: { id: 555 },
        text: 'hola',
      },
    });
    expect(message).toEqual({
      channel: 'telegram',
      externalMessageId: '42',
      externalConversationId: '555',
      sender: { externalId: '777', displayName: 'Ana' },
      content: { type: 'text', text: 'hola' },
    });
  });
});

describe('XAdapter', () => {
  it('reads the first direct message event', async () => {
    const message = await createXAdapter().parseInboundEvent({
      direct_message_events: [
        {
          id: 'dm_1',
          message_create: {
            sender_id: 'u_1',
            target: { recipient_id: 'u_2' },
            message_data: { text: 'hola' },
          },
        },
      ],
    });
    expect(message.externalMessageId).toBe('dm_1');
    expect(message.sender.externalId).toBe('u_1');
    expect(message.content).toEqual({ type: 'text', text: 'hola' });
  });
});

describe('validateWebhook (simulated token auth)', () => {
  it('accepts any call when no secret is configured', async () => {
    const adapter = createWebChatAdapter();
    expect(await adapter.validateWebhook({}, {})).toBe(true);
  });

  it('requires the matching token when a secret is configured', async () => {
    const adapter = createWebChatAdapter({ secret: 's3cr3t' });
    expect(await adapter.validateWebhook({}, {})).toBe(false);
    expect(await adapter.validateWebhook({}, { 'x-webhook-token': 'wrong' })).toBe(false);
    expect(await adapter.validateWebhook({}, { 'x-webhook-token': 's3cr3t' })).toBe(true);
  });
});
