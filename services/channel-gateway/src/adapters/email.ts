import type { CanonicalInboundMessage } from '@cx-orbit/shared';
import { z } from 'zod';
import { type AdapterOptions, type InboundAdapter, tokenValidator } from './base.js';

/** Inbound email webhook shape (à la Mailgun/SendGrid inbound parse). */
const emailPayloadSchema = z.object({
  messageId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1).optional(),
  subject: z.string().optional(),
  text: z.string().min(1),
});

export function createEmailAdapter(options: AdapterOptions = {}): InboundAdapter {
  return {
    channel: 'email',
    async parseInboundEvent(payload): Promise<CanonicalInboundMessage> {
      const p = emailPayloadSchema.parse(payload);
      const text = p.subject ? `${p.subject}\n\n${p.text}` : p.text;
      return {
        channel: 'email',
        externalMessageId: p.messageId,
        sender: { externalId: p.from },
        content: { type: 'text', text },
      };
    },
    validateWebhook: tokenValidator(options.secret),
  };
}
