# Interview Walkthrough — CX-ORBIT

A guided narrative for explaining the system in a technical interview. Every claim
maps to code, an ADR, a metric, a test, or an injectable incident.

## 1. What problem does this solve?

Enterprise contact centers are **distributed systems under adversarial I/O**: flaky
providers, at-least-once delivery, AI hallucinations, and ops pressure. CX-ORBIT is a
**lab** that makes those failure modes visible — not a CRUD demo.

**Say this:** “I built an event-driven contact center so I could practice production
patterns end-to-end: idempotency, outbox, retries/breakers, validated AI, and incident
response with runbooks.”

## 2. Architecture in 60 seconds

```text
Webhook → Channel Gateway → NATS JetStream → Conversation / Customer / AI / Routing
                                         → Outbound → Provider simulator
                                         → Analytics
Incident Simulator ──(Redis faults / event floods)──► same services
Operator UI (React) ──HTTP──► REST APIs + Grafana
```

- **Async by default** (ADR-001): HTTP only at edges (webhooks, operator reads, demos).
- **Canonical events** in `@cx-orbit/shared` with Zod versioning.
- **Polyglot persistence** (ADR-003): Mongo for conversations, Postgres for identity/rules, Redis for idempotency/faults/DLQ.

## 3. Message lifecycle (happy path)

1. Provider webhook hits `POST /webhooks/:channel` (gateway).
2. Adapter normalizes → `CanonicalInboundMessage`; Redis NX idempotency key.
3. `message.received` published to JetStream (`msgID = eventId`).
4. Conversation service writes message + outbox **in one Mongo transaction**.
5. Outbox relay publishes `conversation.*`; AI consumes updates with text; validates output.
6. Routing decides team/priority/handoff with **explainable reasons**.
7. Conversation enqueues `message.send.requested`; outbound delivers with retry/breaker/DLQ.
8. Analytics rolls up business + technical metrics; Grafana + `/summary`.

**Observable:** one `correlationId` / `traceId` across logs; Prometheus RED + domain metrics.

## 4. Decisions worth defending

| Decision | Why | Where to point |
| -------- | --- | -------------- |
| NATS JetStream | Durable streams, consumer lag, subject fan-out | ADR-001, analytics lag gauges |
| Outbox | Crash between commit and publish must not lose events | ADR-005, INC-006 |
| Idempotency = Redis NX + unique index | Race-safe under retries | ADR-004, INC-001 |
| Retry + jitter + breaker + DLQ | Provider timeouts without retry storms | ADR-006, INC-002 |
| Zod-validate AI | Invalid LLM JSON must not crash the bus | ADR-008, INC-005 |
| Not everything is a microservice | Shared kit in `platform`; one SPA | ADR-010 |

## 5. Incidents as teaching tools

| ID | Inject | Symptom | Fix story |
| -- | ------ | ------- | --------- |
| INC-001 | Duplicate `message.received` | `result=duplicate` | Unique index + Redis NX |
| INC-002 | `webchat_simulate=timeout` | Retries → breaker → DLQ | Resilience kit |
| INC-003 | Event flood | Consumer lag | Scale consumers / backpressure |
| INC-004 | `db_latency_ms` | Handler p95 ↑ | Indexes / pool / budgets |
| INC-005 | `ai_force_failure=INVALID_JSON` | Fallback analysis | Zod + fallback |
| INC-006 | `outbox_drop=1` | Pending outbox grows | Relay drain / outbox |

Trigger from UI (`/incidents`) or `POST :8087/incidents/start`. Each has runbook + postmortem.

## 6. Testing story

- **Unit:** routing engine, resilience, AI validation, gateway adapters, outbox relay faults.
- **Integration:** `RUN_INTEGRATION=1` — Mongo/Postgres/Redis/NATS.
- **Contract:** WhatsApp/WebChat fixtures + shared event registry.
- **E2E:** `RUN_E2E=1` WhatsApp webhook → analytics inbound.
- **CI:** lint → typecheck → unit → build → integration (Compose) → Docker image matrix.

## 7. Demo script (5–7 minutes)

1. `pnpm infra:up` + start services + `pnpm --filter @cx-orbit/frontend dev`.
2. Dashboard shows live `/summary` counters.
3. Send webchat/WhatsApp webhook; open conversation timeline + routing reasons.
4. Start INC-002; show outbound failures / breaker; stop incident.
5. Start INC-006; show outbox pending; stop; show drain.
6. Open Grafana business dashboard; mention lag panels.

## 8. What I would do next in production

- CDC outbox instead of polling; multi-region NATS; real LLM providers behind the same interface.
- Admission control at the gateway; autoscaling on consumer lag.
- AuthN/Z for the operator console; BFF instead of browser→service proxy.

None of those are missing by accident — they are **documented trade-offs** to keep the lab laptop-runnable.
