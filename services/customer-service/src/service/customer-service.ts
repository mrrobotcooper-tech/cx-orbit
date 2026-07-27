import {
  type Logger,
  type PgClient,
  type PostgresConnection,
  isUniqueViolationError,
} from '@cx-orbit/platform';
import {
  type AnyEvent,
  type EventEnvelope,
  type EventType,
  createEvent,
  newCustomerId,
} from '@cx-orbit/shared';
import type { CustomerMetrics } from '../metrics.js';

const SOURCE = 'customer-service';

export interface CustomerServiceDeps {
  pg: PostgresConnection;
  metrics: CustomerMetrics;
  logger: Logger;
  notifyOutbox?: () => void;
}

interface TraceContext {
  correlationId: string;
  traceId: string;
}

export function createCustomerService(deps: CustomerServiceDeps) {
  const { pg, metrics, logger } = deps;

  function makeEvent<T extends EventType>(
    eventType: T,
    payload: EventEnvelope<T>['payload'],
    trace: TraceContext,
  ): AnyEvent {
    return createEvent({
      eventType,
      payload,
      source: SOURCE,
      correlationId: trace.correlationId,
      traceId: trace.traceId,
    }) as unknown as AnyEvent;
  }

  async function enqueue(client: PgClient, events: AnyEvent[]): Promise<void> {
    for (const event of events) {
      await client.query('INSERT INTO customer.outbox (id, event) VALUES ($1, $2::jsonb)', [
        event.eventId,
        JSON.stringify(event),
      ]);
    }
  }

  /**
   * Resolve the sender's identity. If (channel, externalId) is already known,
   * it's a no-op (the mapping was announced once). Otherwise create a customer +
   * identity and emit `customer.created` + `customer.identified` via the outbox,
   * all in one transaction. Idempotent under at-least-once redelivery.
   */
  async function handleMessageReceived(
    event: EventEnvelope<'message.received'>,
  ): Promise<{ status: 'existing' | 'created'; customerId?: string }> {
    const { channel } = event.payload;
    const externalId = event.payload.sender.externalId;
    const displayName = event.payload.sender.displayName;
    const trace: TraceContext = {
      correlationId: event.correlationId,
      traceId: event.traceId,
    };

    const found = await pg.query<{ customer_id: string }>(
      'SELECT customer_id FROM customer.identities WHERE channel = $1 AND external_id = $2',
      [channel, externalId],
    );
    const existing = found.rows[0];
    if (existing) {
      metrics.resolved.inc({ result: 'existing' });
      return { status: 'existing', customerId: existing.customer_id };
    }

    const customerId = newCustomerId();
    try {
      await pg.withTransaction(async (client) => {
        await client.query('INSERT INTO customer.customers (id, display_name) VALUES ($1, $2)', [
          customerId,
          displayName ?? null,
        ]);
        await client.query(
          'INSERT INTO customer.identities (customer_id, channel, external_id, display_name) VALUES ($1, $2, $3, $4)',
          [customerId, channel, externalId, displayName ?? null],
        );

        const created = makeEvent(
          'customer.created',
          {
            customerId,
            channel,
            externalId,
            ...(displayName !== undefined ? { displayName } : {}),
          },
          trace,
        );
        const identified = makeEvent(
          'customer.identified',
          { customerId, channel, externalId },
          trace,
        );
        await enqueue(client, [created, identified]);
      });
    } catch (err) {
      if (isUniqueViolationError(err)) {
        // Concurrent delivery created the identity first — resolve to existing.
        metrics.resolved.inc({ result: 'existing' });
        return { status: 'existing' };
      }
      throw err;
    }

    metrics.resolved.inc({ result: 'created' });
    metrics.customersCreated.inc();
    deps.notifyOutbox?.();
    logger.info({ customerId, channel }, 'customer identity created');
    return { status: 'created', customerId };
  }

  return { handleMessageReceived };
}

export type CustomerService = ReturnType<typeof createCustomerService>;
