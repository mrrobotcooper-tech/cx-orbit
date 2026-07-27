import { z } from 'zod';
import { newCorrelationId, newEventId, newTraceId } from '../ids.js';
import { EventEnvelopeBaseSchema, type AnyEvent, type EventEnvelope } from './envelope.js';
import {
  AiAnalysisCompletedPayloadSchema,
  ConversationAssignedPayloadSchema,
  ConversationCreatedPayloadSchema,
  ConversationResolvedPayloadSchema,
  ConversationUpdatedPayloadSchema,
  CustomerCreatedPayloadSchema,
  CustomerIdentifiedPayloadSchema,
  IncidentEndedPayloadSchema,
  IncidentStartedPayloadSchema,
  MessageDeliveryFailedPayloadSchema,
  MessageNormalizedPayloadSchema,
  MessageReceivedPayloadSchema,
  MessageSendRequestedPayloadSchema,
  MessageSentPayloadSchema,
  RoutingCompletedPayloadSchema,
  type EventPayloadMap,
  type EventType,
} from './payloads.js';

/** Current schema version for each event type (see event catalog). */
export const CURRENT_EVENT_VERSION = 1;

/**
 * Version-aware registry mapping `eventType -> version -> payload schema`.
 * `satisfies` guarantees, at compile time, that every EventType has an entry.
 * When a breaking change lands, add a new version key here and keep the old
 * one during the migration window.
 */
export const eventPayloadRegistry = {
  'message.received': { 1: MessageReceivedPayloadSchema },
  'message.normalized': { 1: MessageNormalizedPayloadSchema },
  'customer.identified': { 1: CustomerIdentifiedPayloadSchema },
  'customer.created': { 1: CustomerCreatedPayloadSchema },
  'conversation.created': { 1: ConversationCreatedPayloadSchema },
  'conversation.updated': { 1: ConversationUpdatedPayloadSchema },
  'ai.analysis.completed': { 1: AiAnalysisCompletedPayloadSchema },
  'routing.completed': { 1: RoutingCompletedPayloadSchema },
  'conversation.assigned': { 1: ConversationAssignedPayloadSchema },
  'message.send.requested': { 1: MessageSendRequestedPayloadSchema },
  'message.sent': { 1: MessageSentPayloadSchema },
  'message.delivery.failed': { 1: MessageDeliveryFailedPayloadSchema },
  'conversation.resolved': { 1: ConversationResolvedPayloadSchema },
  'incident.started': { 1: IncidentStartedPayloadSchema },
  'incident.ended': { 1: IncidentEndedPayloadSchema },
} satisfies Record<EventType, Record<number, z.ZodTypeAny>>;

/** Thrown when an event type/version pair has no registered schema. */
export class UnknownEventError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly version: number,
  ) {
    super(`No schema registered for event "${eventType}" version ${version}`);
    this.name = 'UnknownEventError';
  }
}

/** Thrown when an event fails schema validation. */
export class EventValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = 'EventValidationError';
  }
}

function lookupSchema(eventType: string, version: number): z.ZodTypeAny | undefined {
  const versions = (eventPayloadRegistry as Record<string, Record<number, z.ZodTypeAny>>)[
    eventType
  ];
  return versions?.[version];
}

/**
 * Validate and strongly type a raw event coming off the bus.
 * Throws `ZodError` on a malformed envelope, `UnknownEventError` on an
 * unregistered type/version, and `EventValidationError` on a bad payload.
 */
export function parseEvent(raw: unknown): AnyEvent {
  const base = EventEnvelopeBaseSchema.parse(raw);
  const schema = lookupSchema(base.eventType, base.version);
  if (!schema) {
    throw new UnknownEventError(base.eventType, base.version);
  }
  const result = schema.safeParse(base.payload);
  if (!result.success) {
    throw new EventValidationError(
      `Invalid payload for "${base.eventType}" v${base.version}`,
      result.error.issues,
    );
  }
  return { ...base, payload: result.data } as AnyEvent;
}

export type SafeParseResult = { success: true; event: AnyEvent } | { success: false; error: Error };

/** Non-throwing variant of {@link parseEvent}. */
export function safeParseEvent(raw: unknown): SafeParseResult {
  try {
    return { success: true, event: parseEvent(raw) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export interface CreateEventInput<T extends EventType> {
  eventType: T;
  payload: EventPayloadMap[T];
  source: string;
  correlationId?: string;
  traceId?: string;
  eventId?: string;
  version?: number;
  occurredAt?: string;
}

/**
 * Build a valid, fully-populated event envelope. Missing ids and timestamp
 * are generated; the payload is validated against the registry so producers
 * cannot emit malformed events.
 */
export function createEvent<T extends EventType>(input: CreateEventInput<T>): EventEnvelope<T> {
  const version = input.version ?? CURRENT_EVENT_VERSION;
  const schema = lookupSchema(input.eventType, version);
  if (!schema) {
    throw new UnknownEventError(input.eventType, version);
  }
  const result = schema.safeParse(input.payload);
  if (!result.success) {
    throw new EventValidationError(
      `Invalid payload for "${input.eventType}" v${version}`,
      result.error.issues,
    );
  }
  return {
    eventId: input.eventId ?? newEventId(),
    eventType: input.eventType,
    version,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    correlationId: input.correlationId ?? newCorrelationId(),
    traceId: input.traceId ?? newTraceId(),
    source: input.source,
    payload: result.data as EventPayloadMap[T],
  };
}

/** Type guard: is a string a known event type? */
export function isEventType(value: string): value is EventType {
  return Object.prototype.hasOwnProperty.call(eventPayloadRegistry, value);
}
