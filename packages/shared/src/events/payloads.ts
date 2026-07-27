import { z } from 'zod';
import {
  ChannelSchema,
  ConversationStatusSchema,
  DeliveryFailureReasonSchema,
  HandoffReasonSchema,
  IncidentTypeSchema,
  SentimentSchema,
} from '../enums.js';
import { CanonicalInboundMessageSchema, MessageContentSchema } from '../messages.js';

// ---- Shared value schemas ---------------------------------------------
const ConfidenceSchema = z.number().min(0).max(1);
const PrioritySchema = z.number().int().min(1).max(10);
const NonEmpty = z.string().min(1);

// ---- Event type enum ---------------------------------------------------
/**
 * Every canonical event type. Kept in sync with docs/events/event-catalog.md.
 * The registry (registry.ts) is `satisfies Record<EventType, ...>`, so the
 * compiler forces a schema for every type listed here.
 */
export const EventTypeSchema = z.enum([
  'message.received',
  'message.normalized',
  'customer.identified',
  'customer.created',
  'conversation.created',
  'conversation.updated',
  'ai.analysis.completed',
  'routing.completed',
  'conversation.assigned',
  'message.send.requested',
  'message.sent',
  'message.delivery.failed',
  'conversation.resolved',
  'incident.started',
  'incident.ended',
]);
export type EventType = z.infer<typeof EventTypeSchema>;
export const EVENT_TYPES = EventTypeSchema.options;

// ---- Payload schemas ---------------------------------------------------

export const MessageReceivedPayloadSchema = CanonicalInboundMessageSchema;
export type MessageReceivedPayload = z.infer<typeof MessageReceivedPayloadSchema>;

export const MessageNormalizedPayloadSchema = z.object({
  originalEventId: NonEmpty,
  message: CanonicalInboundMessageSchema,
});
export type MessageNormalizedPayload = z.infer<typeof MessageNormalizedPayloadSchema>;

export const CustomerIdentifiedPayloadSchema = z.object({
  customerId: NonEmpty,
  channel: ChannelSchema,
  externalId: NonEmpty,
  conversationId: NonEmpty.optional(),
});
export type CustomerIdentifiedPayload = z.infer<typeof CustomerIdentifiedPayloadSchema>;

export const CustomerCreatedPayloadSchema = z.object({
  customerId: NonEmpty,
  channel: ChannelSchema,
  externalId: NonEmpty,
  displayName: NonEmpty.optional(),
});
export type CustomerCreatedPayload = z.infer<typeof CustomerCreatedPayloadSchema>;

export const ConversationCreatedPayloadSchema = z.object({
  conversationId: NonEmpty,
  customerId: NonEmpty.optional(),
  channel: ChannelSchema,
  externalConversationId: NonEmpty.optional(),
  status: ConversationStatusSchema,
  firstMessageId: NonEmpty.optional(),
});
export type ConversationCreatedPayload = z.infer<typeof ConversationCreatedPayloadSchema>;

export const ConversationUpdatedPayloadSchema = z.object({
  conversationId: NonEmpty,
  status: ConversationStatusSchema.optional(),
  changes: z.record(z.string(), z.unknown()).optional(),
});
export type ConversationUpdatedPayload = z.infer<typeof ConversationUpdatedPayloadSchema>;

export const AiAnalysisCompletedPayloadSchema = z.object({
  conversationId: NonEmpty,
  messageId: NonEmpty.optional(),
  intent: NonEmpty,
  sentiment: SentimentSchema,
  confidence: ConfidenceSchema,
  entities: z.record(z.string(), z.string()).optional(),
});
export type AiAnalysisCompletedPayload = z.infer<typeof AiAnalysisCompletedPayloadSchema>;

export const RoutingCompletedPayloadSchema = z.object({
  conversationId: NonEmpty,
  assignedTeam: NonEmpty,
  priority: PrioritySchema,
  reason: z.array(NonEmpty).min(1),
  handoffToHuman: z.boolean().optional(),
  handoffReason: HandoffReasonSchema.optional(),
});
export type RoutingCompletedPayload = z.infer<typeof RoutingCompletedPayloadSchema>;

export const ConversationAssignedPayloadSchema = z.object({
  conversationId: NonEmpty,
  assignedTeam: NonEmpty,
  assignedAgentId: NonEmpty.optional(),
});
export type ConversationAssignedPayload = z.infer<typeof ConversationAssignedPayloadSchema>;

export const MessageSendRequestedPayloadSchema = z.object({
  conversationId: NonEmpty,
  channel: ChannelSchema,
  recipientExternalId: NonEmpty,
  content: MessageContentSchema,
  idempotencyKey: NonEmpty,
});
export type MessageSendRequestedPayload = z.infer<typeof MessageSendRequestedPayloadSchema>;

export const MessageSentPayloadSchema = z.object({
  conversationId: NonEmpty,
  channel: ChannelSchema,
  idempotencyKey: NonEmpty,
  providerMessageId: NonEmpty.optional(),
  attempts: z.number().int().positive(),
});
export type MessageSentPayload = z.infer<typeof MessageSentPayloadSchema>;

export const MessageDeliveryFailedPayloadSchema = z.object({
  conversationId: NonEmpty,
  channel: ChannelSchema,
  idempotencyKey: NonEmpty,
  reason: DeliveryFailureReasonSchema,
  attempts: z.number().int().positive(),
  deadLettered: z.boolean().optional(),
});
export type MessageDeliveryFailedPayload = z.infer<typeof MessageDeliveryFailedPayloadSchema>;

export const ConversationResolvedPayloadSchema = z.object({
  conversationId: NonEmpty,
  resolvedBy: z.enum(['bot', 'agent']),
  resolutionTimeMs: z.number().int().nonnegative().optional(),
});
export type ConversationResolvedPayload = z.infer<typeof ConversationResolvedPayloadSchema>;

export const IncidentStartedPayloadSchema = z.object({
  incidentId: NonEmpty,
  type: IncidentTypeSchema,
  durationSeconds: z.number().int().positive().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type IncidentStartedPayload = z.infer<typeof IncidentStartedPayloadSchema>;

export const IncidentEndedPayloadSchema = z.object({
  incidentId: NonEmpty,
  type: IncidentTypeSchema,
  reason: z.enum(['completed', 'manual', 'error']).optional(),
});
export type IncidentEndedPayload = z.infer<typeof IncidentEndedPayloadSchema>;

// ---- Type-level payload map -------------------------------------------
/**
 * Maps each event type to its payload TS type. Used to give `EventEnvelope<T>`
 * a strongly typed `payload`. Runtime validation lives in the registry.
 */
export interface EventPayloadMap {
  'message.received': MessageReceivedPayload;
  'message.normalized': MessageNormalizedPayload;
  'customer.identified': CustomerIdentifiedPayload;
  'customer.created': CustomerCreatedPayload;
  'conversation.created': ConversationCreatedPayload;
  'conversation.updated': ConversationUpdatedPayload;
  'ai.analysis.completed': AiAnalysisCompletedPayload;
  'routing.completed': RoutingCompletedPayload;
  'conversation.assigned': ConversationAssignedPayload;
  'message.send.requested': MessageSendRequestedPayload;
  'message.sent': MessageSentPayload;
  'message.delivery.failed': MessageDeliveryFailedPayload;
  'conversation.resolved': ConversationResolvedPayload;
  'incident.started': IncidentStartedPayload;
  'incident.ended': IncidentEndedPayload;
}
