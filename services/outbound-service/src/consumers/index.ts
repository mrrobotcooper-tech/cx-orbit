import {
  type EventBus,
  type Logger,
  type RunningConsumer,
  eventSubject,
  startEventConsumer,
} from '@cx-orbit/platform';
import type { OutboundMetrics } from '../metrics.js';
import type { DeliveryService } from '../service/delivery-service.js';

export interface StartConsumersOptions {
  durable: string;
  maxDeliver: number;
}

export async function startConsumers(
  bus: EventBus,
  service: DeliveryService,
  metrics: OutboundMetrics,
  logger: Logger,
  options: StartConsumersOptions,
): Promise<RunningConsumer> {
  return startEventConsumer(
    bus,
    {
      durable: options.durable,
      filterSubjects: [eventSubject('message.send.requested')],
      maxDeliver: options.maxDeliver,
      logger,
    },
    async (event) => {
      metrics.eventsConsumed.inc({ type: event.eventType });
      if (event.eventType === 'message.send.requested') {
        await service.handleSendRequested(event);
      }
    },
  );
}
