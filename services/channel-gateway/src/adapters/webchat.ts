import type { CanonicalInboundMessage, Sender } from '@cx-orbit/shared';
import { z } from 'zod';
import { type AdapterOptions, type InboundAdapter, tokenValidator } from './base.js';

/** Payload shape emitted by our own WebChat widget / simulator. */
const webChatPayloadSchema = z.object({
  sessionId: z.string().min(1),
  messageId: z.string().min(1),
  from: z.object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
  }),
  text: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }).optional(),
});

export function createWebChatAdapter(options: AdapterOptions = {}): InboundAdapter {
  return {
    channel: 'webchat',
    async parseInboundEvent(payload): Promise<CanonicalInboundMessage> {
      const p = webChatPayloadSchema.parse(payload);
      const sender: Sender =
        p.from.name !== undefined
          ? { externalId: p.from.id, displayName: p.from.name }
          : { externalId: p.from.id };
      return {
        channel: 'webchat',
        externalMessageId: p.messageId,
        externalConversationId: p.sessionId,
        sender,
        content: { type: 'text', text: p.text },
      };
    },
    validateWebhook: tokenValidator(options.secret),
  };
}
