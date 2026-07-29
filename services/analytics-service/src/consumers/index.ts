import {
  type EventBus,
  type Logger,
  type RunningConsumer,
  EVENT_SUBJECT_PREFIX,
  startEventConsumer,
} from '@cx-orbit/platform';
import type { Aggregator } from '../aggregator.js';
import type { AnalyticsMetrics } from '../metrics.js';

export interface StartConsumersOptions {
  durable: string;
  maxDeliver: number;
}

/**
 * Subscribe to the entire canonical event namespace. Analytics is read-only and
 * must stay idempotent at the metric level (counters only go up — redelivery
 * may double-count; acceptable for a lab rollup; durable consumer + ack keep
 * lag low under normal load).
 */
export async function startConsumers(
  bus: EventBus,
  aggregator: Aggregator,
  logger: Logger,
  options: StartConsumersOptions,
): Promise<RunningConsumer> {
  return startEventConsumer(
    bus,
    {
      durable: options.durable,
      filterSubjects: [`${EVENT_SUBJECT_PREFIX}.>`],
      maxDeliver: options.maxDeliver,
      logger,
    },
    async (event) => {
      aggregator.recordEvent(event);
    },
  );
}

/** Poll JetStream consumer info and export lag/pending gauges. */
export function startLagPoller(
  bus: EventBus,
  durable: string,
  metrics: AnalyticsMetrics,
  logger: Logger,
  intervalMs: number,
): { stop: () => void } {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const tick = async (): Promise<void> => {
    try {
      const info = await bus.jsm.consumers.info(bus.streamName, durable);
      metrics.consumerLag.set(info.num_pending);
      metrics.consumerPending.set(info.num_ack_pending);
    } catch (err) {
      logger.warn({ err }, 'failed to poll consumer lag');
    }
  };

  const loop = (): void => {
    void tick().finally(() => {
      if (!stopped) timer = setTimeout(loop, intervalMs);
    });
  };
  loop();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
