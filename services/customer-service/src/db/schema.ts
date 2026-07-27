import type { PostgresConnection } from '@cx-orbit/platform';

/**
 * DDL for the Customer Service, applied idempotently on boot. Tables live in the
 * `customer` schema (created by the Phase 1 Postgres init). Each service owns its
 * own tables within its bounded context (ADR-009).
 */
const SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS customer;

CREATE TABLE IF NOT EXISTS customer.customers (
  id            text PRIMARY KEY,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer.identities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   text NOT NULL REFERENCES customer.customers(id) ON DELETE CASCADE,
  channel       text NOT NULL,
  external_id   text NOT NULL,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_identities_customer ON customer.identities (customer_id);

CREATE TABLE IF NOT EXISTS customer.outbox (
  id            text PRIMARY KEY,
  event         jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  attempts      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customer_outbox_pending ON customer.outbox (status, created_at);
`;

export async function ensureSchema(pg: PostgresConnection): Promise<void> {
  await pg.query(SCHEMA_SQL);
}
