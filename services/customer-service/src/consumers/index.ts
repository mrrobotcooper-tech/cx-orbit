import {
  type EventBus,
  type Logger,
  type RunningConsumer,
  eventSubject,
  startEventConsumer,
} from '@cx-orbit/platform';
import type { CustomerMetrics } from '../metrics.js';
import type { CustomerService } from '../service/customer-service.js';

export interface StartConsumersOptions {
  durable: string;
  maxDeliver: number;
}

/**
 * Consume `message.received` to resolve/create the sender's identity. Handler is
 * idempotent (unique (channel, external_id) + pre-check), safe under redelivery.
 */
export async function startConsumers(
  bus: EventBus,
  service: CustomerService,
  metrics: CustomerMetrics,
  logger: Logger,
  options: StartConsumersOptions,
): Promise<RunningConsumer> {
  return startEventConsumer(
    bus,
    {
      durable: options.durable,
      filterSubjects: [eventSubject('message.received')],
      maxDeliver: options.maxDeliver,
      logger,
    },
    async (event) => {
      metrics.eventsConsumed.inc({ type: event.eventType });
      if (event.eventType === 'message.received') {
        await service.handleMessageReceived(event);
      }
    },
  );
}
