# Incident Postmortems

> **Status:** Phase 0 (index only). Full postmortems are written as each incident is implemented (Phase 10)
> and finalized in Phase 14. Each postmortem follows the template below.

The Incident Simulation Engine (`services/incident-simulator`, Phase 10) injects controlled failures. Every
incident links a **runbook** (how to respond) and a **postmortem** (what happened & how we fixed it).

## Incident index

| ID | Title | Theme | Runbook | Postmortem |
| -- | ----- | ----- | ------- | ---------- |
| INC-001 | Duplicate Messages | Idempotency / race condition | [runbook](../runbooks/duplicate-messages.md) | `INC-001-duplicate-messages.md` |
| INC-002 | Provider Timeout | Timeout → retry → backoff → circuit breaker → fallback | [runbook](../runbooks/provider-timeout.md) | `INC-002-provider-timeout.md` |
| INC-003 | Queue Backlog | Backpressure / consumer throughput | [runbook](../runbooks/queue-backlog.md) | `INC-003-queue-backlog.md` |
| INC-004 | Database Latency | Slow queries / pool exhaustion | [runbook](../runbooks/database-latency.md) | `INC-004-database-latency.md` |
| INC-005 | AI Invalid Response | Output validation / fallback | [runbook](../runbooks/ai-provider-failure.md) | `INC-005-ai-invalid-response.md` |
| INC-006 | Event Loss | Outbox / reconciliation | [runbook](../runbooks/event-loss.md) | `INC-006-event-loss.md` |

## Postmortem template

Each postmortem (`INC-00X-*.md`) contains:

```text
Summary
Impact
Timeline
Detection
Investigation
Root Cause
Contributing Factors
Mitigation
Permanent Fix
Regression Tests
Preventive Actions
```

## Incident types available in the simulator

`DUPLICATE_MESSAGES`, `PROVIDER_TIMEOUT`, `PROVIDER_RATE_LIMIT`, `DATABASE_LATENCY`,
`DATABASE_CONNECTION_EXHAUSTION`, `QUEUE_BACKLOG`, `EVENT_LOSS`, `AI_INVALID_RESPONSE`, `AI_TIMEOUT`,
`MEMORY_LEAK`, `HIGH_ERROR_RATE`, `PARTIAL_OUTAGE`.

Each injected incident: modifies a component's behavior, produces observable symptoms, emits metrics, produces
logs, is diagnosable, can be disabled, and is documented.
