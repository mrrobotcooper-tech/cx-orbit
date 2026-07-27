# ADR-007 — Observability Strategy

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** SRE, DevOps Engineer, Backend Engineer

## Context

The entire value of CX-ORBIT is making distributed behavior **visible**. Incidents must be diagnosable from
signals alone: "a queue can grow with zero errors", "an API can return 200 while the business fails". That
requires logs, metrics and traces that correlate across services.

## Decision

Adopt the **three pillars** with correlation baked in:

1. **Structured logging (Pino, JSON).** Every log line carries `service`, `level`, `event`, and, when
   available, `correlationId`, `traceId`, `conversationId`. Never log secrets/PII beyond what is necessary.
2. **Metrics (Prometheus).** Every service exposes `/metrics`. Standard RED/USE-style metrics plus domain
   metrics (provider health, breaker state, queue depth, AI containment, handoff rate).
3. **Tracing (OpenTelemetry, optional).** A single `traceId` propagates across services and appears in logs;
   toggled with `OTEL_ENABLED` to keep the local footprint optional.
4. **Dashboards (Grafana)** over Prometheus + **Loki** for logs.
5. **Health endpoints:** every service exposes `/health` (liveness), `/ready` (readiness), `/metrics`.
6. **Separate technical vs business metrics** (documented) so we can show a system that is *technically
   healthy but functionally degraded*.

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| **Plain text logs** | Not queryable/correlatable; useless for multi-service incident diagnosis. |
| **Metrics only (no logs/traces)** | Metrics tell you *that* something is wrong, not *why*. |
| **A single SaaS APM** | Not local-first; the brief requires a self-contained stack. |
| **Mandatory tracing** | OTel adds overhead/complexity; making it optional keeps the lab lightweight while still demonstrable. |

## Trade-offs

- **Pro:** every incident is diagnosable from dashboards + logs + traces; runbooks can reference concrete signals.
- **Pro:** correlationId/traceId make cross-service flows reconstructable.
- **Con:** instrumentation is cross-cutting work in every service (mitigated by shared logging/metrics utils).
- **Con:** running Prometheus/Grafana/Loki adds containers (acceptable locally).

## Consequences

- `packages/shared` provides a logger factory and a metrics registry helper used by all services.
- Correlation IDs are generated at the gateway and propagated through events and HTTP headers.
- Grafana dashboards are provisioned as code under `infra/grafana`.
- Runbooks (Phase 14) reference specific metrics and log queries for each incident.
- A **secret-redaction** policy is enforced in the logger (deny-list of sensitive fields).
