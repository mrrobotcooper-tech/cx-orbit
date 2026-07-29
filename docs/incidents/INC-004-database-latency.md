# INC-004 — Database Latency

## Summary
Artificial Mongo delay in conversation handlers increased p95 and slowed the pipeline.

## Impact
Higher end-to-end latency; possible outbox pending growth.

## Timeline
Start INC-004 → Redis `db_latency_ms` → handlers sleep → stop clears delay.

## Detection
Handler duration metrics; "db latency fault active" logs.

## Investigation
Redis fault key; Mongo slow query logs (real incidents).

## Root Cause
Slow DB path under load / missing indexes (lab: injected sleep).

## Contributing Factors
Synchronous handler work on the hot path.

## Mitigation
Stop INC-004.

## Permanent Fix
Indexes, pool tuning, query budgets (ADR-003).

## Regression Tests
Engine sets/clears `DB_LATENCY_MS`.

## Preventive Actions
p95 alerts on conversation handlers.
