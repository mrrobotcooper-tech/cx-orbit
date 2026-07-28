import { Counter, Gauge, Histogram, type Registry } from '@cx-orbit/platform';

export interface OutboundMetrics {
  providerRequests: Counter<'channel' | 'result'>;
  providerFailures: Counter<'channel' | 'reason'>;
  providerLatency: Histogram<'channel'>;
  circuitState: Gauge<'channel'>;
  dlqSize: Gauge<string>;
  eventsConsumed: Counter<'type'>;
  eventsPublished: Counter<'type'>;
}

const STATE_VALUE: Record<string, number> = { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 };

export function createOutboundMetrics(registry: Registry): OutboundMetrics {
  return {
    providerRequests: new Counter({
      name: 'provider_requests_total',
      help: 'Outbound provider requests by result',
      labelNames: ['channel', 'result'] as const,
      registers: [registry],
    }),
    providerFailures: new Counter({
      name: 'provider_failures_total',
      help: 'Outbound provider failures by reason',
      labelNames: ['channel', 'reason'] as const,
      registers: [registry],
    }),
    providerLatency: new Histogram({
      name: 'provider_latency_seconds',
      help: 'Outbound provider call latency',
      labelNames: ['channel'] as const,
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    }),
    circuitState: new Gauge({
      name: 'circuit_breaker_state',
      help: 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
      labelNames: ['channel'] as const,
      registers: [registry],
    }),
    dlqSize: new Gauge({
      name: 'outbound_dlq_size',
      help: 'Messages in the outbound DLQ',
      registers: [registry],
    }),
    eventsConsumed: new Counter({
      name: 'outbound_events_consumed_total',
      help: 'Events consumed from JetStream',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    eventsPublished: new Counter({
      name: 'outbound_events_published_total',
      help: 'Events published to NATS',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
  };
}

export function circuitStateValue(state: string): number {
  return STATE_VALUE[state] ?? -1;
}
