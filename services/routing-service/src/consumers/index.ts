import {
  type EventBus,
  type Logger,
  type RunningConsumer,
  eventSubject,
  startEventConsumer,
} from '@cx-orbit/platform';
import type { RoutingMetrics } from '../metrics.js';
import type { RoutingService } from '../service/routing-service.js';

export interface StartConsumersOptions {
  durable: string;
  maxDeliver: number;
}

export async function startConsumers(
  bus: EventBus,
  service: RoutingService,
  metrics: RoutingMetrics,
  logger: Logger,
  options: StartConsumersOptions,
): Promise<RunningConsumer> {
  return startEventConsumer(
    bus,
    {
      durable: options.durable,
      filterSubjects: [eventSubject('ai.analysis.completed')],
      maxDeliver: options.maxDeliver,
      logger,
    },
    async (event) => {
      metrics.eventsConsumed.inc({ type: event.eventType });
      if (event.eventType === 'ai.analysis.completed') {
        await service.handleAiAnalysisCompleted(event);
      }
    },
  );
}
