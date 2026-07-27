import { z } from 'zod';

/**
 * Supported communication channels. Provider-specific details never leak
 * past the adapter boundary (see ADR-002); everything downstream speaks
 * in terms of these canonical channels.
 */
export const CHANNELS = [
  'whatsapp',
  'telegram',
  'email',
  'instagram',
  'facebook',
  'x',
  'webchat',
] as const;
export const ChannelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof ChannelSchema>;

/** Sentiment produced by the AI Service. */
export const SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
export const SentimentSchema = z.enum(SENTIMENTS);
export type Sentiment = z.infer<typeof SentimentSchema>;

/** Conversation lifecycle states (owned by the Conversation Service). */
export const CONVERSATION_STATUSES = [
  'OPEN',
  'WAITING_CUSTOMER',
  'WAITING_AGENT',
  'WAITING_EXTERNAL_SERVICE',
  'RESOLVED',
  'CLOSED',
] as const;
export const ConversationStatusSchema = z.enum(CONVERSATION_STATUSES);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

/** Kinds of message content the canonical model can carry. */
export const MESSAGE_CONTENT_TYPES = [
  'text',
  'image',
  'audio',
  'video',
  'file',
  'location',
] as const;
export const MessageContentTypeSchema = z.enum(MESSAGE_CONTENT_TYPES);
export type MessageContentType = z.infer<typeof MessageContentTypeSchema>;

/** Why a conversation was handed off to a human agent. */
export const HANDOFF_REASONS = [
  'LOW_AI_CONFIDENCE',
  'CUSTOMER_REQUEST',
  'NEGATIVE_SENTIMENT',
  'VIP_CUSTOMER',
  'AI_UNAVAILABLE',
  'POLICY',
] as const;
export const HandoffReasonSchema = z.enum(HANDOFF_REASONS);
export type HandoffReason = z.infer<typeof HandoffReasonSchema>;

/** Normalized outbound delivery failure reasons. */
export const DELIVERY_FAILURE_REASONS = [
  'TIMEOUT',
  'PROVIDER_ERROR',
  'RATE_LIMITED',
  'INVALID_RECIPIENT',
  'CIRCUIT_OPEN',
  'UNKNOWN',
] as const;
export const DeliveryFailureReasonSchema = z.enum(DELIVERY_FAILURE_REASONS);
export type DeliveryFailureReason = z.infer<typeof DeliveryFailureReasonSchema>;

/** Incident types the Incident Simulation Engine can inject (Phase 10). */
export const INCIDENT_TYPES = [
  'DUPLICATE_MESSAGES',
  'PROVIDER_TIMEOUT',
  'PROVIDER_RATE_LIMIT',
  'DATABASE_LATENCY',
  'DATABASE_CONNECTION_EXHAUSTION',
  'QUEUE_BACKLOG',
  'EVENT_LOSS',
  'AI_INVALID_RESPONSE',
  'AI_TIMEOUT',
  'MEMORY_LEAK',
  'HIGH_ERROR_RATE',
  'PARTIAL_OUTAGE',
] as const;
export const IncidentTypeSchema = z.enum(INCIDENT_TYPES);
export type IncidentType = z.infer<typeof IncidentTypeSchema>;
