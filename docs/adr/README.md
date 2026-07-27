# Architecture Decision Records (ADRs)

ADRs capture significant architectural decisions: the **context** that forced a decision, the **decision**
itself, the **alternatives** considered, the **trade-offs**, and the **consequences**.

> Format: lightweight [MADR](https://adr.github.io/madr/)-style. One decision per file, immutable once
> accepted (superseded rather than edited).

## Status legend

- `Proposed` — under discussion
- `Accepted` — decided and in effect
- `Superseded by ADR-XXX` — replaced

## Index

| ADR | Title | Status |
| --- | ----- | ------ |
| [ADR-001](ADR-001-event-driven-architecture.md) | Event-Driven Architecture with NATS JetStream | Accepted |
| [ADR-002](ADR-002-channel-adapter-boundaries.md) | Channel Adapter Boundaries | Accepted |
| [ADR-003](ADR-003-database-selection.md) | Polyglot Persistence: Mongo + Postgres + Redis | Accepted |
| [ADR-004](ADR-004-idempotency-strategy.md) | Idempotency Strategy | Accepted |
| [ADR-005](ADR-005-outbox-pattern.md) | Outbox Pattern for Reliable Publishing | Accepted |
| [ADR-006](ADR-006-retry-and-circuit-breaker.md) | Retries, Timeouts & Circuit Breaker | Accepted |
| [ADR-007](ADR-007-observability-strategy.md) | Observability Strategy | Accepted |
| [ADR-008](ADR-008-ai-provider-abstraction.md) | AI Provider Abstraction | Accepted |
| [ADR-009](ADR-009-microservice-boundaries.md) | Microservice Boundaries | Accepted |
| [ADR-010](ADR-010-why-not-everything-is-a-microservice.md) | Why Not Everything Is a Microservice | Accepted |
