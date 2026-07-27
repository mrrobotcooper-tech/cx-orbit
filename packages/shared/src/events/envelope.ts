import { z } from 'zod';
import { EventTypeSchema, type EventPayloadMap, type EventType } from './payloads.js';

/**
 * Base envelope shared by every event on the bus. `payload` is validated
 * separately against the per-type schema in the registry, so here it is
 * intentionally `unknown`.
 *
 * See docs/events/event-catalog.md for the contract and versioning policy.
 */
export const EventEnvelopeBaseSchema = z.object({
  eventId: z.string().min(1),
  eventType: EventTypeSchema,
  version: z.number().int().positive(),
  occurredAt: z.string().datetime({ offset: true }),
  correlationId: z.string().min(1),
  traceId: z.string().min(1),
  source: z.string().min(1),
  payload: z.unknown(),
});
export type EventEnvelopeBase = z.infer<typeof EventEnvelopeBaseSchema>;

/**
 * A fully typed event: the envelope with a `payload` narrowed by `eventType`.
 * Consumers can `switch (event.eventType)` to narrow the payload type.
 */
export interface EventEnvelope<T extends EventType = EventType> {
  eventId: string;
  eventType: T;
  version: number;
  occurredAt: string;
  correlationId: string;
  traceId: string;
  source: string;
  payload: EventPayloadMap[T];
}

/** Union of every concrete typed event. */
export type AnyEvent = { [T in EventType]: EventEnvelope<T> }[EventType];
