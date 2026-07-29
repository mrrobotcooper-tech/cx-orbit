import type { IncidentType } from '@cx-orbit/shared';

export interface IncidentDefinition {
  code: string;
  type: IncidentType;
  title: string;
  theme: string;
  symptoms: string[];
  diagnosis: string[];
  runbook: string;
  /** True when the effect is applied via Redis fault flags consumed by other services. */
  usesFaultFlags: boolean;
}

/** The six Phase-10 incidents (roadmap INC-001..006). */
export const PHASE10_INCIDENTS: readonly IncidentDefinition[] = [
  {
    code: 'INC-001',
    type: 'DUPLICATE_MESSAGES',
    title: 'Duplicate Messages',
    theme: 'Idempotency / race condition',
    symptoms: [
      'Two message.received events share the same (channel, externalMessageId)',
      'conversation-service reports result=duplicate for the second delivery',
      'Exactly one message document exists for that external id',
    ],
    diagnosis: [
      'Prometheus: conversation_messages_processed_total{result="duplicate"}',
      'Logs: conversation-service "duplicate"',
      'Mongo: unique index on messages (channel, externalMessageId)',
    ],
    runbook: 'docs/runbooks/duplicate-messages.md',
    usesFaultFlags: false,
  },
  {
    code: 'INC-002',
    type: 'PROVIDER_TIMEOUT',
    title: 'Provider Timeout',
    theme: 'Timeout → retry → backoff → circuit breaker',
    symptoms: [
      'Webchat simulator receives x-simulate-fault: timeout',
      'outbound-service retries with backoff then opens the breaker',
      'message.delivery.failed events appear; DLQ may grow',
    ],
    diagnosis: [
      'Prometheus: outbound delivery failures / circuit_breaker state',
      'Logs: outbound-service TIMEOUT',
      'Redis fault key: cxorbit:fault:webchat_simulate=timeout',
    ],
    runbook: 'docs/runbooks/provider-timeout.md',
    usesFaultFlags: true,
  },
  {
    code: 'INC-003',
    type: 'QUEUE_BACKLOG',
    title: 'Queue Backlog',
    theme: 'Backpressure / consumer throughput',
    symptoms: [
      'Burst of message.received events published to JetStream',
      'Consumer lag gauges rise on conversation / analytics',
      'Processing latency increases until the flood drains',
    ],
    diagnosis: [
      'Prometheus: jetstream consumer lag',
      'Analytics /summary technical.eventsByType',
      'NATS stream pending messages',
    ],
    runbook: 'docs/runbooks/queue-backlog.md',
    usesFaultFlags: false,
  },
  {
    code: 'INC-004',
    type: 'DATABASE_LATENCY',
    title: 'Database Latency',
    theme: 'Slow queries / pool pressure',
    symptoms: [
      'conversation-service sleeps before Mongo work (injected delay)',
      'Inbound message handling p95 rises',
      'Outbox pending may grow while handlers are slow',
    ],
    diagnosis: [
      'Prometheus: conversation request / handler duration',
      'Logs: "db latency fault active"',
      'Redis fault key: cxorbit:fault:db_latency_ms',
    ],
    runbook: 'docs/runbooks/database-latency.md',
    usesFaultFlags: true,
  },
  {
    code: 'INC-005',
    type: 'AI_INVALID_RESPONSE',
    title: 'AI Invalid Response',
    theme: 'Output validation / fallback',
    symptoms: [
      'Mock AI returns schema-invalid payloads',
      'ai-service falls back and still emits ai.analysis.completed',
      'Routing may hand off on low confidence / fallback',
    ],
    diagnosis: [
      'Prometheus: ai analyses with fallback / validation failures',
      'Logs: AIValidationError',
      'Redis fault key: cxorbit:fault:ai_force_failure=INVALID_JSON',
    ],
    runbook: 'docs/runbooks/ai-provider-failure.md',
    usesFaultFlags: true,
  },
  {
    code: 'INC-006',
    type: 'EVENT_LOSS',
    title: 'Event Loss',
    theme: 'Outbox / reconciliation',
    symptoms: [
      'Outbox relay skips publish while fault is active (crash window)',
      'Outbox documents remain status=pending',
      'Downstream consumers miss conversation.* until fault is cleared',
    ],
    diagnosis: [
      'Prometheus: conversation_outbox_pending',
      'Mongo: outbox status=pending growing',
      'Redis fault key: cxorbit:fault:outbox_drop=1',
    ],
    runbook: 'docs/runbooks/event-loss.md',
    usesFaultFlags: true,
  },
] as const;

const byType = new Map(PHASE10_INCIDENTS.map((d) => [d.type, d]));
const byCode = new Map(PHASE10_INCIDENTS.map((d) => [d.code, d]));

export function definitionForType(type: IncidentType): IncidentDefinition | undefined {
  return byType.get(type);
}

export function definitionForCode(code: string): IncidentDefinition | undefined {
  return byCode.get(code.toUpperCase());
}

export function resolveIncidentType(
  input: { type?: string; code?: string },
): IncidentDefinition | undefined {
  if (input.code) return definitionForCode(input.code);
  if (input.type) {
    const asCode = definitionForCode(input.type);
    if (asCode) return asCode;
    return definitionForType(input.type as IncidentType);
  }
  return undefined;
}
