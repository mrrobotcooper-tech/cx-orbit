import {
  type EventBus,
  type Logger,
  type RunningConsumer,
  eventSubject,
  startEventConsumer,
} from '@cx-orbit/platform';
import type { Collections } from '../db/collections.js';
import type { ConversationMetrics } from '../metrics.js';
import type { ConversationService } from '../service/conversation-service.js';

export interface StartConsumersOptions {
  durable: string;
  maxDeliver: number;
}

/**
 * Subscribe to the events this service reacts to and dispatch them to the
 * domain service. The handler is idempotent (the service dedupes on the unique
 * index), which is mandatory under at-least-once delivery.
 */
export async function startConsumers(
  bus: EventBus,
  collections: Collections,
  service: ConversationService,
  metrics: ConversationMetrics,
  logger: Logger,
  options: StartConsumersOptions,
): Promise<RunningConsumer> {
  return startEventConsumer(
    bus,
    {
      durable: options.durable,
      filterSubjects: [eventSubject('message.received'), eventSubject('routing.completed')],
      maxDeliver: options.maxDeliver,
      logger,
      onDeadLetter: async (dl) => {
        await collections.deadLetters.insertOne({
          reason: dl.reason,
          error: dl.error,
          raw: dl.raw,
          subject: dl.meta.subject,
          deliveryCount: dl.meta.deliveryCount,
          createdAt: new Date(),
        });
        logger.error({ subject: dl.meta.subject, reason: dl.reason }, 'event dead-lettered');
      },
    },
    async (event) => {
      metrics.eventsConsumed.inc({ type: event.eventType });
      switch (event.eventType) {
        case 'message.received':
          await service.handleMessageReceived(event);
          break;
        case 'routing.completed':
          await service.handleRoutingCompleted(event);
          break;
        default:
          break;
      }
    },
  );
}
