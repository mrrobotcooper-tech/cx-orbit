# INC-003 — Queue Backlog

## Summary
A flood of `message.received` events raised JetStream consumer lag.

## Impact
Slower conversation/analytics processing until the backlog drained.

## Timeline
Start INC-003 → N publishes → lag gauges rise → stop (no further flood) → drain.

## Detection
Consumer lag / pending metrics; analytics event counts.

## Investigation
Correlate with incident-simulator flood logs / batchId metadata.

## Root Cause
Ingress burst exceeding consumer throughput.

## Contributing Factors
Single consumer replicas; no admission control.

## Mitigation
Stop flood; optionally scale consumers.

## Permanent Fix
Lag alerts, horizontal scale, backpressure design (ADR-001).

## Regression Tests
Engine flood count test (default 3 in unit defaults).

## Preventive Actions
Capacity planning; lag SLOs.
