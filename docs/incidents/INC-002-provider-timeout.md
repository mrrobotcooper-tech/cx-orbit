# INC-002 — Provider Timeout

## Summary
Webchat provider timed out; outbound retried with backoff and opened the circuit breaker.

## Impact
Delivery failures and temporary pause of webchat outbound while breaker open.

## Timeline
Start INC-002 → Redis `webchat_simulate=timeout` → outbound TIMEOUT → retries/breaker → stop clears fault.

## Detection
Delivery failure metrics; breaker state; outbound logs.

## Investigation
Check Redis fault key and webchat simulator headers.

## Root Cause
Unreliable provider latency without resilience (before Phase 8).

## Contributing Factors
No timeout budget / no breaker.

## Mitigation
Stop INC-002; wait for breaker reset.

## Permanent Fix
Retry + backoff + circuit breaker + DLQ.

## Regression Tests
Engine sets/clears `WEBCHAT_SIMULATE`; outbound unit tests for TIMEOUT path.

## Preventive Actions
Alert on elevated TIMEOUT rate and open breakers.
