import { AckPolicy, DeliverPolicy, type ConsumerConfig } from 'nats';
import { type AnyEvent, safeParseEvent } from '@cx-orbit/shared';
import type { Logger } from '../logger.js';
import type { EventBus } from './nats.js';
import { eventCodec } from './nats.js';

export interface ConsumerHandlerMeta {
  subject: string;
  redelivered: boolean;
  /** 1-based number of times this message has been delivered. */
  deliveryCount: number;
}

export type EventHandler = (event: AnyEvent, meta: ConsumerHandlerMeta) => Promise<void>;

export interface DeadLetter {
  reason: 'invalid_schema' | 'handler_error';
  error: string;
  raw: unknown;
  meta: ConsumerHandlerMeta;
}

export interface StartConsumerOptions {
  /** Durable consumer name (survives restarts, resumes where it left off). */
  durable: string;
  /** Subjects to filter, e.g. ['cxorbit.events.message.received']. */
  filterSubjects: string[];
  /** Terminal delivery attempts before a message is dead-lettered. Default 5. */
  maxDeliver?: number;
  /** Ack wait before redelivery, in ms. Default 30_000. */
  ackWaitMs?: number;
  /** Base backoff for nak redelivery, in ms. Default 500. */
  baseBackoffMs?: number;
  /** Max backoff cap, in ms. Default 30_000. */
  maxBackoffMs?: number;
  /** Max in-flight unacked messages. Default 100. */
  maxAckPending?: number;
  /**
   * Called once a message is terminally failed (bad schema, or handler failed
   * after maxDeliver). Implement to persist to a dead-letter store. If it
   * throws, the message is nak'd and retried later instead of being dropped.
   */
  onDeadLetter?: (dl: DeadLetter) => Promise<void>;
  logger?: Logger;
}

export interface RunningConsumer {
  stop(): Promise<void>;
}

function backoffMs(attempt: number, base: number, max: number): number {
  const exp = Math.min(base * 2 ** Math.max(0, attempt - 1), max);
  // Full jitter to avoid thundering herds on redelivery.
  return Math.floor(Math.random() * exp);
}

/**
 * Start a durable JetStream consumer over the canonical event stream with
 * at-least-once delivery, explicit acks, exponential-backoff redelivery and a
 * dead-letter hook (ADR-001 / ADR-006). The handler MUST be idempotent because
 * redelivery is always possible.
 */
export async function startEventConsumer(
  bus: EventBus,
  options: StartConsumerOptions,
  handler: EventHandler,
): Promise<RunningConsumer> {
  const maxDeliver = options.maxDeliver ?? 5;
  const baseBackoff = options.baseBackoffMs ?? 500;
  const maxBackoff = options.maxBackoffMs ?? 30_000;
  const log = options.logger;

  const config: Partial<ConsumerConfig> = {
    durable_name: options.durable,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.All,
    filter_subjects: options.filterSubjects,
    max_deliver: maxDeliver,
    ack_wait: (options.ackWaitMs ?? 30_000) * 1_000_000,
    max_ack_pending: options.maxAckPending ?? 100,
  };

  await bus.jsm.consumers.add(bus.streamName, config);
  const consumer = await bus.js.consumers.get(bus.streamName, options.durable);
  const messages = await consumer.consume();

  const deadLetter = async (dl: DeadLetter): Promise<boolean> => {
    if (!options.onDeadLetter) {
      log?.error(
        { ...dl.meta, reason: dl.reason, err: dl.error },
        'dead-letter (no handler): dropping',
      );
      return true;
    }
    try {
      await options.onDeadLetter(dl);
      return true;
    } catch (err) {
      log?.error({ err }, 'dead-letter handler failed; will retry message');
      return false;
    }
  };

  const loop = (async () => {
    for await (const m of messages) {
      const meta: ConsumerHandlerMeta = {
        subject: m.subject,
        redelivered: m.redelivered,
        deliveryCount: m.info.redeliveryCount,
      };

      const parsed = safeParseEvent(eventCodec.decode(m.data));
      if (!parsed.success) {
        const handled = await deadLetter({
          reason: 'invalid_schema',
          error: parsed.error.message,
          raw: safeDecode(m.data),
          meta,
        });
        if (handled) m.term();
        else m.nak(backoffMs(meta.deliveryCount, baseBackoff, maxBackoff));
        continue;
      }

      try {
        await handler(parsed.event, meta);
        m.ack();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (meta.deliveryCount >= maxDeliver) {
          const handled = await deadLetter({
            reason: 'handler_error',
            error: message,
            raw: parsed.event,
            meta,
          });
          if (handled) m.term();
          else m.nak(backoffMs(meta.deliveryCount, baseBackoff, maxBackoff));
        } else {
          log?.warn({ ...meta, err: message }, 'handler failed; nak for redelivery');
          m.nak(backoffMs(meta.deliveryCount, baseBackoff, maxBackoff));
        }
      }
    }
  })();

  return {
    async stop(): Promise<void> {
      messages.stop();
      await loop;
    },
  };
}

function safeDecode(data: Uint8Array): unknown {
  try {
    return eventCodec.decode(data);
  } catch {
    return new TextDecoder().decode(data);
  }
}
