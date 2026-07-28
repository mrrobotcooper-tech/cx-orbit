import { Counter, Gauge, type Registry } from '@cx-orbit/platform';

export interface RoutingMetrics {
  decisions: Counter<'handoff'>;
  eventsConsumed: Counter<'type'>;
  outboxPublished: Counter<'type'>;
  outboxPending: Gauge<string>;
}

export function createRoutingMetrics(registry: Registry): RoutingMetrics {
  return {
    decisions: new Counter({
      name: 'routing_decisions_total',
      help: 'Routing decisions, by handoff flag',
      labelNames: ['handoff'] as const,
      registers: [registry],
    }),
    eventsConsumed: new Counter({
      name: 'routing_events_consumed_total',
      help: 'Events consumed from JetStream, by type',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    outboxPublished: new Counter({
      name: 'routing_outbox_published_total',
      help: 'Outbox events published to NATS, by type',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    outboxPending: new Gauge({
      name: 'routing_outbox_pending',
      help: 'Outbox entries awaiting publication',
      registers: [registry],
    }),
  };
}
