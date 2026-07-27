import { z } from 'zod';
import { ChannelSchema, MessageContentTypeSchema } from './enums.js';

/** Who sent a message, expressed with the provider's external identity. */
export const SenderSchema = z.object({
  externalId: z.string().min(1),
  displayName: z.string().min(1).optional(),
});
export type Sender = z.infer<typeof SenderSchema>;

/**
 * Message content. Text messages must carry non-empty text; media types
 * must carry a media URL. The refinement keeps invalid combinations out
 * of the system at the boundary.
 */
export const MessageContentSchema = z
  .object({
    type: MessageContentTypeSchema,
    text: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    caption: z.string().optional(),
  })
  .superRefine((content, ctx) => {
    if (content.type === 'text' && (content.text?.trim().length ?? 0) === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'text content requires a non-empty "text" field',
        path: ['text'],
      });
    }
    const mediaTypes = ['image', 'audio', 'video', 'file'];
    if (mediaTypes.includes(content.type) && !content.mediaUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${content.type} content requires a "mediaUrl"`,
        path: ['mediaUrl'],
      });
    }
  });
export type MessageContent = z.infer<typeof MessageContentSchema>;

/**
 * The canonical inbound message. This is what the Channel Gateway emits
 * after normalizing a provider-specific webhook (ADR-002). No provider
 * payload shape appears beyond this point.
 */
export const CanonicalInboundMessageSchema = z.object({
  channel: ChannelSchema,
  externalMessageId: z.string().min(1),
  externalConversationId: z.string().min(1).optional(),
  sender: SenderSchema,
  content: MessageContentSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CanonicalInboundMessage = z.infer<typeof CanonicalInboundMessageSchema>;
