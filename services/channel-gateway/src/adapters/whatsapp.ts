import type { CanonicalInboundMessage, Sender } from '@cx-orbit/shared';
import { z } from 'zod';
import { type AdapterOptions, type InboundAdapter, required, tokenValidator } from './base.js';

/**
 * Simplified WhatsApp Cloud API webhook shape. We only model the fields the
 * gateway needs to build a canonical message.
 */
const whatsAppPayloadSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z.object({
                contacts: z
                  .array(
                    z.object({
                      profile: z.object({ name: z.string() }).optional(),
                      wa_id: z.string(),
                    }),
                  )
                  .optional(),
                messages: z
                  .array(
                    z.object({
                      from: z.string().min(1),
                      id: z.string().min(1),
                      timestamp: z.string().optional(),
                      type: z.string(),
                      text: z.object({ body: z.string() }).optional(),
                    }),
                  )
                  .min(1),
              }),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export function createWhatsAppAdapter(options: AdapterOptions = {}): InboundAdapter {
  return {
    channel: 'whatsapp',
    async parseInboundEvent(payload): Promise<CanonicalInboundMessage> {
      const p = whatsAppPayloadSchema.parse(payload);
      const value = required(required(p.entry[0], 'entry').changes[0], 'change').value;
      const msg = required(value.messages[0], 'message');
      const name = value.contacts?.[0]?.profile?.name;

      const externalId = `+${msg.from}`;
      const sender: Sender =
        name !== undefined ? { externalId, displayName: name } : { externalId };

      return {
        channel: 'whatsapp',
        externalMessageId: msg.id,
        externalConversationId: msg.from,
        sender,
        content: { type: 'text', text: msg.text?.body ?? '' },
      };
    },
    validateWebhook: tokenValidator(options.secret),
  };
}
