import {
  type EventBus,
  type PostgresConnection,
  Registry,
  connectEventBus,
  connectPostgres,
  createLogger,
} from '@cx-orbit/platform';
import { type EventEnvelope, createEvent } from '@cx-orbit/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureSchema } from '../src/db/schema.js';
import { createCustomerMetrics } from '../src/metrics.js';
import { createOutboxRelay } from '../src/outbox/relay.js';
import { createCustomerService } from '../src/service/customer-service.js';

/**
 * Integration tests against LIVE infra (Postgres + NATS). Opt-in:
 *   RUN_INTEGRATION=1 pnpm --filter @cx-orbit/customer-service test
 */
const RUN = process.env.RUN_INTEGRATION === '1';
const suite = RUN ? describe : describe.skip;

const POSTGRES_URL =
  process.env.POSTGRES_URL ?? 'postgresql://cxorbit:cxorbit@localhost:5433/cxorbit';
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';
const logger = createLogger({ service: 'customer-it', level: 'silent' });

function messageReceived(externalId: string): EventEnvelope<'message.received'> {
  return createEvent({
    eventType: 'message.received',
    source: 'integration-test',
    payload: {
      channel: 'webchat',
      externalMessageId: `wc_${externalId}`,
      externalConversationId: `sess_${externalId}`,
      sender: { externalId, displayName: 'Ana' },
      content: { type: 'text', text: 'hola' },
    },
  });
}

suite('customer-service integration', () => {
  let pg: PostgresConnection;
  let bus: EventBus;

  beforeAll(async () => {
    pg = await connectPostgres({ connectionString: POSTGRES_URL });
    bus = await connectEventBus({ url: NATS_URL, streamName: 'CXORBIT' });
    await ensureSchema(pg);
    await pg.query('TRUNCATE customer.identities, customer.customers, customer.outbox CASCADE');
  });

  afterAll(async () => {
    await pg.query('TRUNCATE customer.identities, customer.customers, customer.outbox CASCADE');
    await bus.close();
    await pg.close();
  });

  function newService() {
    return createCustomerService({
      pg,
      metrics: createCustomerMetrics(new Registry()),
      logger,
    });
  }

  it('creates a customer + identity and enqueues two outbox events', async () => {
    const service = newService();
    const externalId = `visitor_${Date.now()}_a`;

    const result = await service.handleMessageReceived(messageReceived(externalId));
    expect(result.status).toBe('created');

    const customers = await pg.query('SELECT id FROM customer.customers WHERE id = $1', [
      result.customerId,
    ]);
    expect(customers.rowCount).toBe(1);

    const identities = await pg.query(
      'SELECT customer_id FROM customer.identities WHERE channel = $1 AND external_id = $2',
      ['webchat', externalId],
    );
    expect(identities.rows[0]?.customer_id).toBe(result.customerId);

    const outbox = await pg.query<{ event: { eventType: string } }>(
      `SELECT event FROM customer.outbox WHERE status = 'pending'`,
    );
    const types = outbox.rows.map((r) => r.event.eventType).sort();
    expect(types).toContain('customer.created');
    expect(types).toContain('customer.identified');
  });

  it('is idempotent: a known identity resolves to existing', async () => {
    const service = newService();
    const externalId = `visitor_${Date.now()}_b`;

    const first = await service.handleMessageReceived(messageReceived(externalId));
    const second = await service.handleMessageReceived(messageReceived(externalId));

    expect(first.status).toBe('created');
    expect(second.status).toBe('existing');

    const count = await pg.query(
      'SELECT COUNT(*)::int AS c FROM customer.identities WHERE channel = $1 AND external_id = $2',
      ['webchat', externalId],
    );
    expect(count.rows[0]?.c).toBe(1);
  });

  it('relay publishes pending events and clears the backlog', async () => {
    const service = newService();
    await service.handleMessageReceived(messageReceived(`visitor_${Date.now()}_c`));

    const before = await pg.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM customer.outbox WHERE status = 'pending'`,
    );
    const pendingBefore = before.rows[0]?.c ?? 0;
    expect(pendingBefore).toBeGreaterThan(0);

    const relay = createOutboxRelay(bus, pg, createCustomerMetrics(new Registry()), logger);
    const published = await relay.pump();
    await relay.stop();

    expect(published).toBe(pendingBefore);
    const after = await pg.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM customer.outbox WHERE status = 'pending'`,
    );
    expect(after.rows[0]?.c).toBe(0);
  });
});
