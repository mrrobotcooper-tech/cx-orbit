import { Counter, Gauge, Histogram, type Registry } from '@cx-orbit/platform';

/**
 * Business + technical metrics derived from the canonical event stream.
 * Kept separate from HTTP RED metrics so Grafana can tell them apart.
 */
export interface AnalyticsMetrics {
  eventsConsumed: Counter<'type'>;
  messagesByChannel: Counter<'channel' | 'direction'>;
  conversationsCreated: Counter<'channel'>;
  conversationsResolved: Counter<'resolved_by'>;
  customersCreated: Counter<string>;
  aiAnalyses: Counter<'intent' | 'sentiment'>;
  aiLowConfidence: Counter<string>;
  routingDecisions: Counter<'team' | 'handoff'>;
  deliveryResults: Counter<'channel' | 'result'>;
  deliveryFailures: Counter<'channel' | 'reason'>;
  resolutionTimeSeconds: Histogram<'resolved_by'>;
  consumerLag: Gauge<string>;
  consumerPending: Gauge<string>;
  lastEventUnix: Gauge<'type'>;
}

export function createAnalyticsMetrics(registry: Registry): AnalyticsMetrics {
  return {
    eventsConsumed: new Counter({
      name: 'analytics_events_consumed_total',
      help: 'Canonical events consumed by analytics, by type',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
    messagesByChannel: new Counter({
      name: 'analytics_messages_total',
      help: 'Messages observed by channel and direction',
      labelNames: ['channel', 'direction'] as const,
      registers: [registry],
    }),
    conversationsCreated: new Counter({
      name: 'analytics_conversations_created_total',
      help: 'Conversations created, by channel',
      labelNames: ['channel'] as const,
      registers: [registry],
    }),
    conversationsResolved: new Counter({
      name: 'analytics_conversations_resolved_total',
      help: 'Conversations resolved, by actor',
      labelNames: ['resolved_by'] as const,
      registers: [registry],
    }),
    customersCreated: new Counter({
      name: 'analytics_customers_created_total',
      help: 'New customers created',
      registers: [registry],
    }),
    aiAnalyses: new Counter({
      name: 'analytics_ai_analyses_total',
      help: 'AI analyses by intent and sentiment',
      labelNames: ['intent', 'sentiment'] as const,
      registers: [registry],
    }),
    aiLowConfidence: new Counter({
      name: 'analytics_ai_low_confidence_total',
      help: 'AI analyses with confidence below containment threshold',
      registers: [registry],
    }),
    routingDecisions: new Counter({
      name: 'analytics_routing_decisions_total',
      help: 'Routing decisions by team and handoff flag',
      labelNames: ['team', 'handoff'] as const,
      registers: [registry],
    }),
    deliveryResults: new Counter({
      name: 'analytics_delivery_results_total',
      help: 'Outbound delivery outcomes',
      labelNames: ['channel', 'result'] as const,
      registers: [registry],
    }),
    deliveryFailures: new Counter({
      name: 'analytics_delivery_failures_total',
      help: 'Outbound delivery failures by reason',
      labelNames: ['channel', 'reason'] as const,
      registers: [registry],
    }),
    resolutionTimeSeconds: new Histogram({
      name: 'analytics_resolution_time_seconds',
      help: 'Conversation resolution time when provided by the event',
      labelNames: ['resolved_by'] as const,
      buckets: [5, 15, 30, 60, 120, 300, 600, 1800, 3600],
      registers: [registry],
    }),
    consumerLag: new Gauge({
      name: 'analytics_consumer_lag',
      help: 'JetStream consumer lag (messages not yet consumed)',
      registers: [registry],
    }),
    consumerPending: new Gauge({
      name: 'analytics_consumer_ack_pending',
      help: 'JetStream consumer ack-pending count',
      registers: [registry],
    }),
    lastEventUnix: new Gauge({
      name: 'analytics_last_event_unixtime',
      help: 'Unix timestamp of the last consumed event, by type',
      labelNames: ['type'] as const,
      registers: [registry],
    }),
  };
}
