import { Counter, Gauge, type Registry } from '@cx-orbit/platform';

export interface ConversationMetrics {
  messagesProcessed: Counter<'result'>;
  conversationsCreated: Counter<string>;
  eventsConsumed: Counter<'type'>;
  outboxPublished: Counter<'type'>;
  outboxPending: Gauge<string>;
}

export function createConversationMetrics(registry: Registry): ConversationMetrics {
  return {
    messagesProcessed: new Counter({
      name: 'conversation_messages_processed_total',
      help: 'Inbound messages processed, by result',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    conversationsCreated: new Counter({
      name: 'conversation_created_total',
      help: 'Conversations created',
      registers: [registry],
    }),
    eventsConsumed: new Counter({
      name: 'conversation_events_consumed_total',
      help: 'Events consumed from JetStream, by type',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    outboxPublished: new Counter({
      name: 'conversation_outbox_published_total',
      help: 'Outbox events published to NATS, by type',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    outboxPending: new Gauge({
      name: 'conversation_outbox_pending',
      help: 'Outbox entries awaiting publication',
      registers: [registry],
    }),
  };
}
