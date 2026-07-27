import type { IdempotencyStore } from '@cx-orbit/platform';
import { type AnyEvent, createEvent, inboundIdempotencyKey } from '@cx-orbit/shared';
import type { InboundAdapter } from './adapters/index.js';
import type { GatewayMetrics } from './metrics.js';

/** Minimal publisher surface so tests can inject a fake without NATS. */
export interface EventPublisher {
  publish(event: AnyEvent): Promise<unknown>;
}

export interface IngestDeps {
  publisher: EventPublisher;
  idempotency: IdempotencyStore;
  metrics: GatewayMetrics;
  idempotencyTtlSeconds?: number | undefined;
}

export interface IngestContext {
  correlationId: string;
  traceId: string;
}

export interface IngestResult {
  status: 'accepted' | 'duplicate';
  eventId?: string;
}

/**
 * Core inbound pipeline, transport-agnostic and infra-free (so it is unit
 * testable): normalize → dedupe (Redis SET NX) → publish `message.received`.
 *
 * The Redis check is the fast first line of defense against provider retries;
 * the authoritative dedupe remains the DB unique index downstream (ADR-004).
 */
export function createIngestService(deps: IngestDeps) {
  return {
    async ingest(
      adapter: InboundAdapter,
      payload: unknown,
      ctx: IngestContext,
    ): Promise<IngestResult> {
      const message = await adapter.parseInboundEvent(payload);
      const key = inboundIdempotencyKey(message.channel, message.externalMessageId);

      const first = await deps.idempotency.markIfFirst(key, deps.idempotencyTtlSeconds);
      if (!first) {
        deps.metrics.duplicates.inc({ channel: message.channel });
        return { status: 'duplicate' };
      }

      const event = createEvent({
        eventType: 'message.received',
        source: 'channel-gateway',
        payload: message,
        correlationId: ctx.correlationId,
        traceId: ctx.traceId,
      });

      await deps.publisher.publish(event);
      deps.metrics.received.inc({ channel: message.channel });
      return { status: 'accepted', eventId: event.eventId };
    },
  };
}

export type IngestService = ReturnType<typeof createIngestService>;
