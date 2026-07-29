# INC-006 — Event Loss

## Summary
Outbox relay skipped publish while the fault was active, simulating a crash after commit.

## Impact
Downstream consumers missed events until the fault cleared and the relay drained pending rows.

## Timeline
Start INC-006 → Redis `outbox_drop=1` → pending grows → stop → relay publishes.

## Detection
`conversation_outbox_pending`; missing downstream events.

## Investigation
Outbox collection status; relay skip logs.

## Root Cause
Publish-after-commit without outbox (before ADR-005).

## Contributing Factors
Process crash between commit and publish.

## Mitigation
Stop INC-006; let relay catch up.

## Permanent Fix
Transactional outbox + durable relay + reconciliation.

## Regression Tests
Engine sets/clears `OUTBOX_DROP`.

## Preventive Actions
Alert on sustained outbox pending.
