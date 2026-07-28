import type { PostgresConnection } from '@cx-orbit/platform';
import { DEFAULT_INTENT_RULES } from '../domain/engine.js';
import type { IntentRule } from '../domain/types.js';

const SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS routing;

CREATE TABLE IF NOT EXISTS routing.intent_rules (
  intent         text PRIMARY KEY,
  team           text NOT NULL,
  base_priority  int NOT NULL CHECK (base_priority BETWEEN 1 AND 10),
  reason         text NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routing.outbox (
  id            text PRIMARY KEY,
  event         jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  attempts      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_routing_outbox_pending ON routing.outbox (status, created_at);

CREATE TABLE IF NOT EXISTS routing.decisions (
  id               text PRIMARY KEY,
  conversation_id  text NOT NULL,
  assigned_team    text NOT NULL,
  priority         int NOT NULL,
  reason           jsonb NOT NULL,
  handoff_to_human boolean NOT NULL DEFAULT false,
  handoff_reason   text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_conv ON routing.decisions (conversation_id, created_at DESC);
`;

export async function ensureSchema(pg: PostgresConnection): Promise<void> {
  await pg.query(SCHEMA_SQL);
  for (const rule of DEFAULT_INTENT_RULES) {
    await pg.query(
      `INSERT INTO routing.intent_rules (intent, team, base_priority, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (intent) DO NOTHING`,
      [rule.intent, rule.team, rule.basePriority, rule.reason],
    );
  }
}

export async function loadIntentRules(pg: PostgresConnection): Promise<IntentRule[]> {
  const res = await pg.query<{
    intent: string;
    team: string;
    base_priority: number;
    reason: string;
  }>('SELECT intent, team, base_priority, reason FROM routing.intent_rules ORDER BY intent');
  if (res.rows.length === 0) return DEFAULT_INTENT_RULES;
  return res.rows.map((r) => ({
    intent: r.intent,
    team: r.team,
    basePriority: r.base_priority,
    reason: r.reason,
  }));
}
