# INC-005 — AI Invalid Response

## Summary
Mock AI returned schema-invalid payloads; validation rejected them and used fallback.

## Impact
More fallback analyses / handoffs; no crash of the AI consumer.

## Timeline
Start INC-005 → Redis `ai_force_failure=INVALID_JSON` → validation failure → fallback emit → stop.

## Detection
AI validation / fallback metrics; routing handoff rate.

## Investigation
Redis fault key; AIValidationError logs.

## Root Cause
Untrusted LLM output without schema validation (before ADR-008).

## Contributing Factors
Provider drift; prompt injection (lab: forced invalid JSON).

## Mitigation
Stop INC-005.

## Permanent Fix
Zod validate + fallback bundle (ADR-008).

## Regression Tests
Engine fault flag; AI provider INVALID_JSON tests.

## Preventive Actions
Alert on elevated fallback rate.
