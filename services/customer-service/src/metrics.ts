import { Counter, Gauge, type Registry } from '@cx-orbit/platform';

export interface CustomerMetrics {
  resolved: Counter<'result'>;
  customersCreated: Counter<string>;
  eventsConsumed: Counter<'type'>;
  outboxPublished: Counter<'type'>;
  outboxPending: Gauge<string>;
}

export function createCustomerMetrics(registry: Registry): CustomerMetrics {
  return {
    resolved: new Counter({
      name: 'customer_identity_resolved_total',
      help: 'Identity resolutions, by result (existing|created)',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    customersCreated: new Counter({
      name: 'customer_created_total',
      help: 'New customers created',
      registers: [registry],
    }),
    eventsConsumed: new Counter({
      name: 'customer_events_consumed_total',
      help: 'Events consumed from JetStream, by type',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    outboxPublished: new Counter({
      name: 'customer_outbox_published_total',
      help: 'Outbox events published to NATS, by type',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    outboxPending: new Gauge({
      name: 'customer_outbox_pending',
      help: 'Outbox entries awaiting publication',
      registers: [registry],
    }),
  };
}
