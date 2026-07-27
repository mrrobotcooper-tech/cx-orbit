import { Counter, type Registry } from '@cx-orbit/platform';

/** Domain metrics for inbound webhook processing (registered on the service registry). */
export interface GatewayMetrics {
  received: Counter<'channel'>;
  duplicates: Counter<'channel'>;
  errors: Counter<'channel' | 'reason'>;
}

export function createGatewayMetrics(registry: Registry): GatewayMetrics {
  return {
    received: new Counter({
      name: 'gateway_inbound_messages_total',
      help: 'Inbound messages accepted and published as message.received',
      labelNames: ['channel'] as const,
      registers: [registry],
    }),
    duplicates: new Counter({
      name: 'gateway_inbound_duplicates_total',
      help: 'Inbound messages ignored because they were duplicates (idempotency)',
      labelNames: ['channel'] as const,
      registers: [registry],
    }),
    errors: new Counter({
      name: 'gateway_inbound_errors_total',
      help: 'Inbound webhook errors by reason',
      labelNames: ['channel', 'reason'] as const,
      registers: [registry],
    }),
  };
}
