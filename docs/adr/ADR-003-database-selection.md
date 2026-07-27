# ADR-003 — Polyglot Persistence: MongoDB + PostgreSQL + Redis

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** Backend Engineer, Distributed Systems Architect, SRE

## Context

Different data in CX-ORBIT has different shapes and access patterns:

- **Conversations & messages:** high write volume, nested/append-heavy, flexible per-channel content,
  read as documents. Schema evolves per channel.
- **Users, agents, teams, routing rules, config, incident definitions:** relational, need constraints,
  joins, transactions, referential integrity.
- **Idempotency keys, cache, rate-limit counters, distributed locks, DLQ, breaker state:** ephemeral,
  extremely low-latency, TTL-based.

Using a single database for all of these forces bad compromises.

## Decision

Adopt **polyglot persistence** with one clear owner per store:

- **MongoDB** → conversations, messages, conversation metadata, customer interaction history.
- **PostgreSQL** → users, agents, teams, routing rules, business configuration, incident definitions,
  system configuration. Also the **outbox table** (ADR-005) because it needs a transaction with business data.
- **Redis** → cache, idempotency keys, rate limiting, distributed locks, short-lived state, DLQ, circuit-breaker state.

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| **Postgres only (JSONB for messages)** | Works, but loses the "document store vs relational" teaching contrast and makes flexible per-channel message content clumsier. |
| **Mongo only** | No strong relational constraints for routing rules/teams; transactions and joins are awkward. |
| **Redis for everything** | Explicitly rejected: Redis is not a system of record. Durability and query needs don't fit. |

## Trade-offs

- **Pro:** each store is used for what it is best at; realistic enterprise pattern.
- **Pro:** enables the **Database Latency** incident (INC-004) with meaningful p95/pool-exhaustion diagnostics.
- **Con:** operational overhead of three engines (acceptable locally via Docker Compose).
- **Con:** cross-store consistency needs care → handled by events + outbox, not distributed transactions.

## When Redis is **not** appropriate (explicitly)

- As a system of record for anything that must survive a flush.
- For complex queries, reporting, or relational integrity.
- For large documents or long-lived business entities.

## Consequences

- No service reads another service's database directly (ADR-009).
- The outbox lives in Postgres alongside the business write it guarantees.
- Redis keys use namespaced prefixes with explicit TTLs; no unbounded keys.
- Integration tests (Phase 12) run against real Mongo/Postgres/Redis containers.
