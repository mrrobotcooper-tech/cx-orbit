import {
  type CircuitBreaker,
  CircuitOpenError,
  type EventBus,
  type IdempotencyStore,
  type Logger,
  TimeoutError,
  createCircuitBreaker,
  withRetry,
} from '@cx-orbit/platform';
import {
  type Channel,
  type DeliveryFailureReason,
  type EventEnvelope,
  createEvent,
} from '@cx-orbit/shared';
import type { OutboundAdapter, ProviderDeliveryError } from '../adapters/types.js';
import type { DeadLetterQueue } from '../dlq.js';
import { circuitStateValue, type OutboundMetrics } from '../metrics.js';

const SOURCE = 'outbound-service';

export interface DeliveryServiceDeps {
  adapters: Record<Channel, OutboundAdapter>;
  bus: EventBus;
  idempotency: IdempotencyStore;
  dlq: DeadLetterQueue;
  metrics: OutboundMetrics;
  logger: Logger;
  maxRetries: number;
  baseBackoffMs: number;
  timeoutMs: number;
  breakerFailureThreshold: number;
  breakerMinRequests: number;
  breakerResetMs: number;
  idempotencyTtlSeconds?: number | undefined;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof CircuitOpenError || err instanceof TimeoutError) return true;
  if (err && typeof err === 'object' && 'retryable' in err) {
    return Boolean((err as ProviderDeliveryError).retryable);
  }
  return true;
}

function toFailureReason(err: unknown): DeliveryFailureReason {
  if (err instanceof CircuitOpenError) return 'CIRCUIT_OPEN';
  if (err instanceof TimeoutError) return 'TIMEOUT';
  if (err && typeof err === 'object' && 'reason' in err) {
    return (err as ProviderDeliveryError).reason;
  }
  return 'UNKNOWN';
}

export function createDeliveryService(deps: DeliveryServiceDeps) {
  const breakers = new Map<Channel, CircuitBreaker>();

  function breakerFor(channel: Channel): CircuitBreaker {
    let b = breakers.get(channel);
    if (!b) {
      b = createCircuitBreaker(channel, {
        failureThreshold: deps.breakerFailureThreshold,
        minRequests: deps.breakerMinRequests,
        resetMs: deps.breakerResetMs,
      });
      breakers.set(channel, b);
    }
    return b;
  }

  async function handleSendRequested(
    event: EventEnvelope<'message.send.requested'>,
  ): Promise<{ status: 'sent' | 'failed' | 'duplicate'; attempts?: number }> {
    const p = event.payload;
    const first = await deps.idempotency.markIfFirst(
      `outbound:${p.idempotencyKey}`,
      deps.idempotencyTtlSeconds,
    );
    if (!first) {
      return { status: 'duplicate' };
    }

    const adapter = deps.adapters[p.channel];
    const breaker = breakerFor(p.channel);
    let attempts = 0;
    const started = Date.now();

    try {
      const result = await withRetry(
        async () => {
          attempts += 1;
          return breaker.exec(() =>
            adapter.sendMessage({
              recipientExternalId: p.recipientExternalId,
              content: p.content,
              idempotencyKey: p.idempotencyKey,
            }),
          );
        },
        {
          maxAttempts: deps.maxRetries,
          baseBackoffMs: deps.baseBackoffMs,
          timeoutMs: deps.timeoutMs,
          isRetryable,
          onRetry: ({ attempt, delayMs, error }) => {
            deps.logger.warn(
              { channel: p.channel, attempt, delayMs, err: String(error) },
              'outbound retry',
            );
          },
        },
      );

      deps.metrics.providerLatency.observe({ channel: p.channel }, (Date.now() - started) / 1000);
      deps.metrics.providerRequests.inc({ channel: p.channel, result: 'success' });
      deps.metrics.circuitState.set({ channel: p.channel }, circuitStateValue(breaker.getState()));

      const sent = createEvent({
        eventType: 'message.sent',
        source: SOURCE,
        correlationId: event.correlationId,
        traceId: event.traceId,
        payload: {
          conversationId: p.conversationId,
          channel: p.channel,
          idempotencyKey: p.idempotencyKey,
          providerMessageId: result.providerMessageId,
          attempts,
        },
      });
      await deps.bus.publish(sent);
      deps.metrics.eventsPublished.inc({ type: 'message.sent' });
      deps.logger.info(
        { conversationId: p.conversationId, channel: p.channel, attempts },
        'message sent',
      );
      return { status: 'sent', attempts };
    } catch (err) {
      const reason = toFailureReason(err);
      deps.metrics.providerLatency.observe({ channel: p.channel }, (Date.now() - started) / 1000);
      deps.metrics.providerRequests.inc({ channel: p.channel, result: 'failure' });
      deps.metrics.providerFailures.inc({ channel: p.channel, reason });
      deps.metrics.circuitState.set({ channel: p.channel }, circuitStateValue(breaker.getState()));

      await deps.dlq.push({
        idempotencyKey: p.idempotencyKey,
        conversationId: p.conversationId,
        channel: p.channel,
        reason,
        attempts,
        payload: p,
        failedAt: new Date().toISOString(),
      });
      deps.metrics.dlqSize.set(await deps.dlq.size());

      const failed = createEvent({
        eventType: 'message.delivery.failed',
        source: SOURCE,
        correlationId: event.correlationId,
        traceId: event.traceId,
        payload: {
          conversationId: p.conversationId,
          channel: p.channel,
          idempotencyKey: p.idempotencyKey,
          reason,
          attempts: Math.max(1, attempts),
          deadLettered: true,
        },
      });
      await deps.bus.publish(failed);
      deps.metrics.eventsPublished.inc({ type: 'message.delivery.failed' });
      deps.logger.error(
        { conversationId: p.conversationId, channel: p.channel, reason, attempts },
        'message delivery failed; dead-lettered',
      );
      return { status: 'failed', attempts };
    }
  }

  function getCircuitState(channel: Channel): string {
    return breakerFor(channel).getState();
  }

  return { handleSendRequested, getCircuitState };
}

export type DeliveryService = ReturnType<typeof createDeliveryService>;
