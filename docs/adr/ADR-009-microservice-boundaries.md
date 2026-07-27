# ADR-009 — Microservice Boundaries

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** Distributed Systems Architect, Backend Engineer

## Context

We need enough services to demonstrate a distributed system, but not so many that we create artificial
complexity. Boundaries must be principled, not decorative.

## Decision

Draw service boundaries along **data ownership** and **rate/reason of change**, following Domain-Driven
Design bounded contexts. Each service:

- **owns exactly one** set of data (its database is private to it);
- exposes its data via **APIs and events**, never via shared DB access;
- has a **single, describable responsibility**.

The chosen services and their reason to exist:

| Service | Bounded context / reason |
| ------- | ------------------------ |
| **Channel Gateway** | Translation & ingestion boundary with the outside world (provider auth, normalization). |
| **Conversation Service** | System of record for conversations & messages; distinct lifecycle & store (Mongo). |
| **Customer Service** | Identity resolution across channels; relational data with its own consistency needs. |
| **AI Service** | Stateless enrichment; different scaling profile & external dependency; swappable. |
| **Routing Service** | Business decisioning owning routing rules; changes for business reasons, not tech ones. |
| **Outbound Service** | Reliability boundary for egress (retry/breaker/DLQ); isolates provider failure. |
| **Analytics Service** | Read-side/consumer; must not slow the write path; scales independently. |
| **Incident Simulator** | Cross-cutting fault injection; deliberately separate so it can perturb others. |

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| **One modular monolith** | Simpler, but wouldn't demonstrate async messaging, partial failure, or independent scaling — the whole point. |
| **A service per channel** | Massive duplication; adapters (ADR-002) already isolate channels within two services. |
| **A service per entity (CRUD-per-table)** | Nano-services; network overhead and coupling with no ownership benefit (see ADR-010). |

## Trade-offs

- **Pro:** clear ownership, independent deploy/scale, realistic failure isolation.
- **Pro:** each service is independently testable and reasoned about.
- **Con:** cross-service consistency is eventual → events + outbox + idempotency (ADR-001/004/005).
- **Con:** more operational surface than a monolith → mitigated by shared libs and Docker Compose.

## Consequences

- No shared database between services; integration is via events/APIs only.
- Shared **contracts** (not shared business logic) live in `packages/shared`.
- Where a boundary would add cost without benefit, we deliberately do **not** split (ADR-010).
