import type { PostgresConnection } from '@cx-orbit/platform';
import type { CustomerRow, IdentityRow } from './domain/types.js';

export interface ListCustomersParams {
  channel?: string | undefined;
  limit: number;
  offset: number;
}

export async function getCustomer(pg: PostgresConnection, id: string): Promise<CustomerRow | null> {
  const res = await pg.query<CustomerRow>(
    'SELECT id, display_name, created_at, updated_at FROM customer.customers WHERE id = $1',
    [id],
  );
  return res.rows[0] ?? null;
}

export async function getIdentitiesFor(
  pg: PostgresConnection,
  customerIds: string[],
): Promise<IdentityRow[]> {
  if (customerIds.length === 0) return [];
  const res = await pg.query<IdentityRow>(
    `SELECT id, customer_id, channel, external_id, display_name, created_at
       FROM customer.identities
      WHERE customer_id = ANY($1)
      ORDER BY created_at ASC`,
    [customerIds],
  );
  return res.rows;
}

export async function listCustomers(
  pg: PostgresConnection,
  params: ListCustomersParams,
): Promise<{ rows: CustomerRow[]; total: number }> {
  if (params.channel) {
    const rows = await pg.query<CustomerRow>(
      `SELECT DISTINCT c.id, c.display_name, c.created_at, c.updated_at
         FROM customer.customers c
         JOIN customer.identities i ON i.customer_id = c.id
        WHERE i.channel = $1
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3`,
      [params.channel, params.limit, params.offset],
    );
    const count = await pg.query<{ total: string }>(
      `SELECT COUNT(DISTINCT c.id) AS total
         FROM customer.customers c
         JOIN customer.identities i ON i.customer_id = c.id
        WHERE i.channel = $1`,
      [params.channel],
    );
    return { rows: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
  }

  const rows = await pg.query<CustomerRow>(
    `SELECT id, display_name, created_at, updated_at
       FROM customer.customers
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2`,
    [params.limit, params.offset],
  );
  const count = await pg.query<{ total: string }>(
    'SELECT COUNT(*) AS total FROM customer.customers',
  );
  return { rows: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
}

export async function resolveByIdentity(
  pg: PostgresConnection,
  channel: string,
  externalId: string,
): Promise<CustomerRow | null> {
  const res = await pg.query<CustomerRow>(
    `SELECT c.id, c.display_name, c.created_at, c.updated_at
       FROM customer.customers c
       JOIN customer.identities i ON i.customer_id = c.id
      WHERE i.channel = $1 AND i.external_id = $2`,
    [channel, externalId],
  );
  return res.rows[0] ?? null;
}
