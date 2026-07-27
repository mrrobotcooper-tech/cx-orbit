import type { CanonicalInboundMessage, Sender } from '@cx-orbit/shared';
import { z } from 'zod';
import { type AdapterOptions, type InboundAdapter, tokenValidator } from './base.js';

/** Simplified Telegram Bot API `Update` for text messages. */
const telegramPayloadSchema = z.object({
  update_id: z.number().optional(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      first_name: z.string().optional(),
      username: z.string().optional(),
    }),
    chat: z.object({ id: z.number() }),
    text: z.string().min(1),
    date: z.number().optional(),
  }),
});

export function createTelegramAdapter(options: AdapterOptions = {}): InboundAdapter {
  return {
    channel: 'telegram',
    async parseInboundEvent(payload): Promise<CanonicalInboundMessage> {
      const { message } = telegramPayloadSchema.parse(payload);
      const displayName = message.from.first_name ?? message.from.username;
      const externalId = String(message.from.id);
      const sender: Sender =
        displayName !== undefined ? { externalId, displayName } : { externalId };

      return {
        channel: 'telegram',
        externalMessageId: String(message.message_id),
        externalConversationId: String(message.chat.id),
        sender,
        content: { type: 'text', text: message.text },
      };
    },
    validateWebhook: tokenValidator(options.secret),
  };
}
