# ADR-004 — Idempotency Strategy

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** Backend Engineer, SRE

## Context

The event bus delivers **at least once** (ADR-001) and external providers **retry webhooks** when they don't
receive a fast 2xx (e.g. after a timeout). Both realities mean the same logical message can arrive multiple
times. A naive check is unsafe under concurrency:

```ts
// RACE CONDITION: two concurrent deliveries both pass the check
if (!(await exists(key))) {
  await insert(record);
}
```

This directly causes **INC-001 — Duplicate Messages**.

## Decision

Implement idempotency with **multiple, layered defenses**, never relying on read-then-write alone:

1. **Business uniqueness key:** inbound messages are unique on **`(channel, externalMessageId)`**.
2. **Database unique indexes** enforce that key (Mongo unique compound index / Postgres unique constraint).
   The DB is the final arbiter — a duplicate insert fails atomically and is treated as "already processed".
3. **Idempotency keys in Redis** (`SET key value NX PX ttl`) for a fast, atomic first-line guard and to make
   webhook responses idempotent at the gateway.
4. **Event-level idempotency:** consumers deduplicate on `eventId` before applying side effects.
5. **Atomic upserts / conditional writes** instead of check-then-act wherever possible.
6. **Safe retries:** operations are designed so a retry converges to the same state (upsert, not blind insert).

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| **Read-then-write only** | Race conditions under concurrency; the exact bug INC-001 demonstrates. |
| **Global distributed lock per message** | Correct but slower and adds a lock dependency on the hot path; DB unique index gives the same guarantee cheaper. |
| **Exactly-once delivery from the bus** | Not offered in practice; "exactly once" is achieved via at-least-once + idempotent consumers. |

## Trade-offs

- **Pro:** correct under concurrency; the DB constraint is the source of truth.
- **Pro:** Redis layer keeps the happy path fast and makes duplicate webhooks cheap to reject.
- **Con:** must handle unique-violation errors gracefully (catch → treat as duplicate, not as failure).
- **Con:** requires discipline: every consumer with side effects must dedupe.

## Consequences

- Migrations create the unique indexes before Phase 3 traffic.
- The gateway returns the **same** response for a duplicate webhook (idempotent endpoint).
- INC-001 has a "before fix" (read-then-write) and "after fix" (unique index + Redis NX) plus a regression
  test that fires the same message concurrently and asserts a single persisted record.
- Redis idempotency keys carry TTLs sized to the provider retry window.
