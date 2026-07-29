# Incident Postmortems

> **Status:** Phase 10 — INC-001…006 implemented with runbooks + postmortems.
> Phase 14 may deepen narrative / interview walkthroughs.

The Incident Simulation Engine (`services/incident-simulator`) injects controlled failures. Every
incident links a **runbook** (how to respond) and a **postmortem** (what happened & how we fixed it).

## Incident index

| ID | Title | Theme | Runbook | Postmortem |
| -- | ----- | ----- | ------- | ---------- |
| INC-001 | Duplicate Messages | Idempotency / race condition | [runbook](../runbooks/duplicate-messages.md) | [INC-001](./INC-001-duplicate-messages.md) |
| INC-002 | Provider Timeout | Timeout → retry → backoff → circuit breaker → fallback | [runbook](../runbooks/provider-timeout.md) | [INC-002](./INC-002-provider-timeout.md) |
| INC-003 | Queue Backlog | Backpressure / consumer throughput | [runbook](../runbooks/queue-backlog.md) | [INC-003](./INC-003-queue-backlog.md) |
| INC-004 | Database Latency | Slow queries / pool exhaustion | [runbook](../runbooks/database-latency.md) | [INC-004](./INC-004-database-latency.md) |
| INC-005 | AI Invalid Response | Output validation / fallback | [runbook](../runbooks/ai-provider-failure.md) | [INC-005](./INC-005-ai-invalid-response.md) |
| INC-006 | Event Loss | Outbox / reconciliation | [runbook](../runbooks/event-loss.md) | [INC-006](./INC-006-event-loss.md) |

## Incident types available in the simulator (Phase 10)

Implemented: `DUPLICATE_MESSAGES`, `PROVIDER_TIMEOUT`, `QUEUE_BACKLOG`, `DATABASE_LATENCY`,
`AI_INVALID_RESPONSE`, `EVENT_LOSS`.

Catalog also lists future types (`PROVIDER_RATE_LIMIT`, `AI_TIMEOUT`, …) for later phases.

Each injected incident: modifies a component's behavior, produces observable symptoms, emits metrics,
produces logs, is diagnosable, can be disabled, and is documented.
