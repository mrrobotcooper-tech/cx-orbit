import {
  type EventBus,
  type Logger,
  type RunningConsumer,
  eventSubject,
  startEventConsumer,
} from '@cx-orbit/platform';
import type { AiMetrics } from '../metrics.js';
import type { AnalysisService } from '../service/analysis-service.js';

export interface StartConsumersOptions {
  durable: string;
  maxDeliver: number;
}

/**
 * React to inbound conversation updates that carry message text. The handler is
 * idempotent (Redis key per conversation+message).
 */
export async function startConsumers(
  bus: EventBus,
  service: AnalysisService,
  metrics: AiMetrics,
  logger: Logger,
  options: StartConsumersOptions,
): Promise<RunningConsumer> {
  return startEventConsumer(
    bus,
    {
      durable: options.durable,
      filterSubjects: [eventSubject('conversation.updated')],
      maxDeliver: options.maxDeliver,
      logger,
    },
    async (event) => {
      metrics.eventsConsumed.inc({ type: event.eventType });
      if (event.eventType === 'conversation.updated') {
        await service.handleConversationUpdated(event);
      }
    },
  );
}
