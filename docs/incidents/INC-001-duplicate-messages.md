# INC-001 — Duplicate Messages

## Summary
Provider or injector published the same inbound message twice. Idempotency collapsed the duplicate.

## Impact
No double-write of messages when the unique index / pre-check works.

## Timeline
Start INC-001 → two `message.received` with same `externalMessageId` → conversation marks second as duplicate → stop incident.

## Detection
`conversation_messages_processed_total{result="duplicate"}` and logs.

## Investigation
Confirm Mongo unique index on `(channel, externalMessageId)`.

## Root Cause
At-least-once delivery without consumer-side dedupe (before ADR-004).

## Contributing Factors
Provider retries; JetStream redelivery.

## Mitigation
Stop the simulator injection; system already safe after the fix.

## Permanent Fix
Unique index + Redis NX at gateway (ADR-004).

## Regression Tests
`incident-simulator` engine test for INC-001; conversation integration duplicate case.

## Preventive Actions
Keep idempotency keys in runbooks; alert on duplicate rate spikes.
