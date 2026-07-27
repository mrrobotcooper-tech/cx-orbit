import type { CanonicalInboundMessage } from '@cx-orbit/shared';
import { z } from 'zod';
import { type AdapterOptions, type InboundAdapter, required, tokenValidator } from './base.js';

/** Simplified X (Twitter) Account Activity direct-message webhook shape. */
const xPayloadSchema = z.object({
  direct_message_events: z
    .array(
      z.object({
        id: z.string().min(1),
        message_create: z.object({
          sender_id: z.string().min(1),
          target: z.object({ recipient_id: z.string().min(1) }).optional(),
          message_data: z.object({ text: z.string().min(1) }),
        }),
      }),
    )
    .min(1),
});

export function createXAdapter(options: AdapterOptions = {}): InboundAdapter {
  return {
    channel: 'x',
    async parseInboundEvent(payload): Promise<CanonicalInboundMessage> {
      const p = xPayloadSchema.parse(payload);
      const event = required(p.direct_message_events[0], 'direct_message_event');
      const { sender_id, message_data } = event.message_create;
      return {
        channel: 'x',
        externalMessageId: event.id,
        externalConversationId: sender_id,
        sender: { externalId: sender_id },
        content: { type: 'text', text: message_data.text },
      };
    },
    validateWebhook: tokenValidator(options.secret),
  };
}
