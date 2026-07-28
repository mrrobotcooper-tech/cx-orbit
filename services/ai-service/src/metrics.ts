import { Counter, type Registry } from '@cx-orbit/platform';

export interface AiMetrics {
  analyses: Counter<'result'>;
  failures: Counter<'reason'>;
  eventsConsumed: Counter<'type'>;
  eventsPublished: Counter<'type'>;
}

export function createAiMetrics(registry: Registry): AiMetrics {
  return {
    analyses: new Counter({
      name: 'ai_analyses_total',
      help: 'Analyses completed, by result (ok|fallback|duplicate)',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    failures: new Counter({
      name: 'ai_provider_failures_total',
      help: 'Provider/validation failures by reason',
      labelNames: ['reason'] as const,
      registers: [registry],
    }),
    eventsConsumed: new Counter({
      name: 'ai_events_consumed_total',
      help: 'Events consumed from JetStream, by type',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    eventsPublished: new Counter({
      name: 'ai_events_published_total',
      help: 'Events published to NATS, by type',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
  };
}
