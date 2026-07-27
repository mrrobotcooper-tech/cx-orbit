# ADR-005 — Outbox Pattern for Reliable Publishing

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** Distributed Systems Architect, Backend Engineer, SRE

## Context

A service often needs to **persist business data and publish an event** about it. Doing these as two separate
steps is unsafe:

```text
DB commit  ──►  publish event  ──►  CRASH
(persisted)     (never sent)
```

If the process crashes between commit and publish, the business state changed but no one is notified — the
event is **lost** (this is **INC-006 — Event Loss**). Publishing before committing is equally wrong (event
about data that may roll back).

## Decision

Use the **Transactional Outbox Pattern** for at least the Conversation Service write path:

1. In a **single database transaction**, write the business row **and** an `outbox` row (the event payload).
2. Commit. Now business data and the intent-to-publish are atomically consistent.
3. A separate **Outbox Publisher** polls (or tails) unpublished outbox rows and publishes them to NATS.
4. On successful publish, mark the outbox row as published (or delete it).
5. Publishing is **at-least-once** → consumers stay idempotent (ADR-004).

Recovery: if the publisher crashes, unpublished rows remain and are picked up on restart → no lost events.

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| **Publish then commit** | Event may describe data that rolls back → phantom events. |
| **Commit then publish (no outbox)** | The crash window loses events → INC-006. |
| **Two-phase commit / XA across DB + broker** | Heavy, poor support, operational pain; discouraged for microservices. |
| **Change Data Capture (Debezium)** | Great in production, but too heavy for this local lab; documented as a scaling option. |

## Trade-offs

- **Pro:** no lost events even across crashes; atomic with business data.
- **Pro:** gives us a concrete, teachable recovery/reconciliation story (INC-006).
- **Con:** extra table + publisher process; events are published slightly after commit (small latency).
- **Con:** at-least-once publishing → duplicates possible (already handled by ADR-004).
- **Con:** requires cleanup/retention of published outbox rows.

## Consequences

- Postgres holds the outbox table (transaction with business data — see ADR-003).
- A background Outbox Publisher runs within/alongside the owning service.
- INC-006 injects a crash between commit and publish, then demonstrates recovery + a **reconciliation** check.
- Deep-dive and diagrams: [`docs/architecture/outbox-pattern.md`](../architecture/outbox-pattern.md).
