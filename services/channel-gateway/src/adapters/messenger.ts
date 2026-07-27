import type { CanonicalInboundMessage, Channel } from '@cx-orbit/shared';
import { z } from 'zod';
import { type AdapterOptions, type InboundAdapter, tokenValidator } from './base.js';

/**
 * Meta Messenger-platform webhook shape, shared by Facebook Messenger and
 * Instagram Direct (both ride the same `messaging` event envelope).
 */
const messengerPayloadSchema = z.object({
  sender: z.object({ id: z.string().min(1) }),
  recipient: z.object({ id: z.string().min(1) }).optional(),
  message: z.object({
    mid: z.string().min(1),
    text: z.string().min(1),
  }),
  timestamp: z.number().optional(),
});

/** Build a Messenger-style adapter bound to a specific channel. */
export function createMessengerAdapter(
  channel: Extract<Channel, 'facebook' | 'instagram'>,
  options: AdapterOptions = {},
): InboundAdapter {
  return {
    channel,
    async parseInboundEvent(payload): Promise<CanonicalInboundMessage> {
      const p = messengerPayloadSchema.parse(payload);
      return {
        channel,
        externalMessageId: p.message.mid,
        externalConversationId: p.sender.id,
        sender: { externalId: p.sender.id },
        content: { type: 'text', text: p.message.text },
      };
    },
    validateWebhook: tokenValidator(options.secret),
  };
}
