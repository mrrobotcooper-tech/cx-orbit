import type { EventBus, Logger } from '@cx-orbit/platform';
import type { Collections } from '../db/collections.js';
import type { ConversationMetrics } from '../metrics.js';

export interface OutboxRelayOptions {
  pollIntervalMs?: number;
  batchSize?: number;
}

export interface OutboxRelay {
  /** Publish all currently-pending entries once. Returns how many were published. */
  pump(): Promise<number>;
  /** Start the periodic background loop. */
  start(): void;
  /** Stop the background loop. */
  stop(): Promise<void>;
}

/**
 * Polls the outbox and publishes pending events to NATS, then marks them
 * published. Publishing uses `msgID = eventId` (JetStream dedup), so even if the
 * relay double-publishes after a crash the broker collapses the duplicate —
 * giving effectively-once delivery end to end (ADR-005 / ADR-001).
 */
export function createOutboxRelay(
  bus: EventBus,
  collections: Collections,
  metrics: ConversationMetrics,
  logger: Logger,
  options: OutboxRelayOptions = {},
): OutboxRelay {
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const batchSize = options.batchSize ?? 50;

  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let pumping = false;

  async function pump(): Promise<number> {
    // Guard against overlapping runs (periodic tick + explicit notify).
    if (pumping) return 0;
    pumping = true;
    let published = 0;
    try {
      const pending = await collections.outbox
        .find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(batchSize)
        .toArray();

      for (const doc of pending) {
        try {
          await bus.publish(doc.event);
          await collections.outbox.updateOne(
            { _id: doc._id },
            { $set: { status: 'published', publishedAt: new Date() }, $inc: { attempts: 1 } },
          );
          metrics.outboxPublished.inc({ type: doc.event.eventType });
          published += 1;
        } catch (err) {
          await collections.outbox.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
          logger.error({ err, eventId: doc._id }, 'outbox publish failed; will retry');
        }
      }

      const remaining = await collections.outbox.countDocuments({ status: 'pending' });
      metrics.outboxPending.set(remaining);
    } finally {
      pumping = false;
    }
    return published;
  }

  function start(): void {
    if (running) return;
    running = true;
    const tick = (): void => {
      void pump().finally(() => {
        if (running) timer = setTimeout(tick, pollIntervalMs);
      });
    };
    tick();
  }

  async function stop(): Promise<void> {
    running = false;
    if (timer) clearTimeout(timer);
    // Drain anything already claimed.
    while (pumping) await new Promise((r) => setTimeout(r, 10));
  }

  return { pump, start, stop };
}
