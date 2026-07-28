import type { EventBus, Logger, PostgresConnection } from '@cx-orbit/platform';
import type { AnyEvent } from '@cx-orbit/shared';
import type { RoutingMetrics } from '../metrics.js';

export interface OutboxRelayOptions {
  pollIntervalMs?: number;
  batchSize?: number;
}

export interface OutboxRelay {
  pump(): Promise<number>;
  start(): void;
  stop(): Promise<void>;
}

interface OutboxRow {
  id: string;
  event: AnyEvent;
}

export function createOutboxRelay(
  bus: EventBus,
  pg: PostgresConnection,
  metrics: RoutingMetrics,
  logger: Logger,
  options: OutboxRelayOptions = {},
): OutboxRelay {
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const batchSize = options.batchSize ?? 50;
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let pumping = false;

  async function pump(): Promise<number> {
    if (pumping) return 0;
    pumping = true;
    let published = 0;
    try {
      const pending = await pg.query<OutboxRow>(
        `SELECT id, event FROM routing.outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1`,
        [batchSize],
      );
      for (const row of pending.rows) {
        try {
          await bus.publish(row.event);
          await pg.query(
            `UPDATE routing.outbox SET status = 'published', published_at = now(), attempts = attempts + 1 WHERE id = $1`,
            [row.id],
          );
          metrics.outboxPublished.inc({ type: row.event.eventType });
          published += 1;
        } catch (err) {
          await pg.query('UPDATE routing.outbox SET attempts = attempts + 1 WHERE id = $1', [
            row.id,
          ]);
          logger.error({ err, eventId: row.id }, 'outbox publish failed; will retry');
        }
      }
      const remaining = await pg.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM routing.outbox WHERE status = 'pending'`,
      );
      metrics.outboxPending.set(Number(remaining.rows[0]?.count ?? 0));
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
    while (pumping) await new Promise((r) => setTimeout(r, 10));
  }

  return { pump, start, stop };
}
