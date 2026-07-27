# ADR-006 — Retries, Timeouts & Circuit Breaker

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** SRE, Backend Engineer

## Context

Outbound delivery depends on external providers that fail in varied ways: slow responses, timeouts, HTTP
500s, rate limiting, and partial availability. Without discipline, failures cause either dropped messages
(no retry) or cascading overload (infinite/aggressive retries hammering a struggling provider). We also must
avoid retry storms and thundering herds.

## Decision

Apply a **layered resilience policy** in the Outbound Service (and reusable utilities in `packages/shared`):

1. **Timeouts** on every provider call (`OUTBOUND_TIMEOUT_MS`). No unbounded waits.
2. **Bounded retries** with **exponential backoff + full jitter** (`OUTBOUND_MAX_RETRIES`,
   `OUTBOUND_BASE_BACKOFF_MS`). **Never infinite.**
3. **Retry only idempotent/safe operations**, and only on retryable errors (timeouts, 429, 5xx) — not on 4xx
   validation errors.
4. **Circuit breaker per provider** with states `CLOSED → OPEN → HALF_OPEN`:
   - Opens when failure rate exceeds a threshold over a minimum request volume.
   - While `OPEN`, fail fast (no calls) and optionally fall back.
   - After a reset timeout, `HALF_OPEN` allows a probe; success → `CLOSED`, failure → `OPEN`.
5. **Dead-Letter Queue (DLQ)** for messages that exhaust retries, for later inspection/replay.
6. **Metrics** on every step: `provider_requests_total`, `provider_failures_total`,
   `provider_latency_seconds`, `circuit_breaker_state`.

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| **Infinite retries** | Amplifies outages, wastes resources, hides failures. Explicitly forbidden by the brief. |
| **Fixed-interval retries** | Synchronized retries → thundering herd; jitter avoids this. |
| **Retries without a breaker** | Keeps pounding a down provider; breaker sheds load and enables recovery. |
| **Breaker without a DLQ** | Failed messages vanish; DLQ preserves them for reconciliation/replay. |

## Trade-offs

- **Pro:** protects both us and the provider; enables graceful degradation and fast recovery.
- **Pro:** directly powers **INC-002 (Provider Timeout)** demonstrating timeout→retry→backoff→breaker→fallback.
- **Con:** more moving parts and tuning (thresholds, windows). Defaults live in `.env`.
- **Con:** a breaker that is too aggressive can cut off a recovering provider; `HALF_OPEN` probing mitigates.
- **Con:** at-least-once + retries → duplicates; handled by idempotency (ADR-004).

## Consequences

- Redis stores breaker state and the DLQ.
- The Incident Simulator can flip a provider simulator into `TIMEOUT`/`ERROR_500`/`RATE_LIMIT` to trip the breaker.
- INC-002 ships with a regression test asserting bounded retries, breaker transitions and no infinite loops.
- Resilience utilities are shared and unit-tested (Phase 12).
