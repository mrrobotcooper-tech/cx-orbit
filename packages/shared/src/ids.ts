import { randomBytes, randomUUID } from 'node:crypto';

/**
 * Prefixed, human-recognizable identifiers. Prefixes make IDs
 * self-describing in logs and traces (see ADR-007).
 */
export const newEventId = (): string => `evt_${randomUUID()}`;
export const newCorrelationId = (): string => `corr_${randomUUID()}`;
export const newConversationId = (): string => `conv_${randomUUID()}`;
export const newCustomerId = (): string => `customer_${randomUUID()}`;
export const newMessageId = (): string => `msg_${randomUUID()}`;
export const newIncidentId = (): string => `inc_${randomUUID()}`;

/**
 * OpenTelemetry-compatible identifiers: a trace id is 16 bytes (32 hex
 * chars) and a span id is 8 bytes (16 hex chars). Keeping these
 * W3C-compatible means the same id works if/when OTel tracing is enabled.
 */
export const newTraceId = (): string => randomBytes(16).toString('hex');
export const newSpanId = (): string => randomBytes(8).toString('hex');

/**
 * Deterministic idempotency key for an inbound message. The uniqueness
 * rule is (channel, externalMessageId) — see ADR-004.
 */
export const inboundIdempotencyKey = (channel: string, externalMessageId: string): string =>
  `inbound:${channel}:${externalMessageId}`;
