# CX-ORBIT — Architecture Overview

> **Audience:** engineers and interviewers who want to understand how CX-ORBIT is designed, why the
> boundaries are where they are, and how a message flows end-to-end.
>
> **Status:** Phase 14 — architecture as implemented. Historical design notes remain; implementation lands
> incrementally per the [roadmap](../development/roadmap.md).

---

## 1. Design Goals & Non-Goals

### Goals

1. **Realistic distributed system.** Model the messy reality of production: partial failures, timeouts,
   duplicates, slow dependencies, lost events, degraded-but-healthy services.
2. **Provider isolation.** No service outside the gateway/outbound boundary knows what "WhatsApp" is.
   Provider quirks live behind adapters.
3. **Observability first.** Every flow is traceable and every failure is measurable.
4. **Explainability.** Routing and AI decisions are transparent, never black boxes.
5. **Reproducibility.** Any incident can be injected, observed, diagnosed, fixed and regression-tested.
6. **Local-first.** The whole platform runs with `docker compose up` — no real third-party APIs required.

### Non-Goals

- Not a production Contact Center; it is an engineering laboratory.
- Not a showcase of "maximum microservices". Boundaries follow ownership of data and rate of change
  (see [ADR-009](../adr/ADR-009-microservice-boundaries.md) and
  [ADR-010](../adr/ADR-010-why-not-everything-is-a-microservice.md)).
- Not tied to any single LLM vendor (see [ADR-008](../adr/ADR-008-ai-provider-abstraction.md)).

---

## 2. C4 — Context (Level 1)

```text
                         ┌──────────────────────────────────────────┐
   Customer              │                CX-ORBIT                   │
 (via WhatsApp,          │   Multichannel Contact Center Platform    │
  Telegram, Email,  ───► │                                          │ ◄─── Operator / Agent
  Web Chat, IG, FB, X)   │  Ingests, normalizes, enriches, routes,   │      (React console)
                         │  answers and measures conversations.      │
                         └──────────────────────────────────────────┘
                                │                         ▲
                                ▼                         │
                    ┌───────────────────────┐   ┌──────────────────────┐
                    │  Provider Simulators   │   │   Observability       │
                    │ (fake external APIs)   │   │ Prometheus / Grafana  │
                    │                        │   │ Loki / OpenTelemetry  │
                    └───────────────────────┘   └──────────────────────┘
```

In a real deployment the "Provider Simulators" box would be the real WhatsApp Cloud API, Telegram Bot API,
an SMTP/IMAP provider, Meta Graph API, the X API, etc. We simulate them so the platform is self-contained,
while keeping the **adapter interfaces identical** to what real integration would require.

---

## 3. C4 — Containers (Level 2)

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                     CX-ORBIT                                           │
│                                                                                       │
│  ┌────────────┐   webhooks    ┌──────────────────┐    canonical events               │
│  │  Provider  │ ────────────► │  Channel Gateway  │ ───────────────┐                  │
│  │ Simulators │ ◄──────────── │  (Fastify)        │                │                  │
│  └────────────┘   outbound    └──────────────────┘                ▼                  │
│        ▲                                                  ┌──────────────────┐         │
│        │                                                  │   Event Bus       │         │
│        │ deliver                                          │  NATS JetStream   │         │
│        │                                                  └──────────────────┘         │
│  ┌──────────────────┐                          publish / subscribe  │                  │
│  │ Outbound Service  │ ◄───────────────────────────────────────────┤                  │
│  │ retry/breaker/DLQ │                                              │                  │
│  └──────────────────┘                                              │                  │
│        ▲                     ┌──────────────┬──────────────┬───────┴───────┬───────┐  │
│        │                     ▼              ▼              ▼               ▼       ▼  │
│        │            ┌───────────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐
│        └─────────── │ Conversation  │ │ Customer  │ │    AI     │ │ Routing  │ │ Analytics │
│         request     │   Service     │ │  Service  │ │  Service  │ │ Service  │ │  Service  │
│                     │  (MongoDB)    │ │(PostgreSQL)│ │ (mock LLM)│ │(Postgres)│ │(consumer) │
│                     └───────────────┘ └───────────┘ └───────────┘ └──────────┘ └───────────┘
│                                                                                       │
│  ┌───────────────────┐        ┌────────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Incident Simulator│        │  MongoDB   │  │  Redis   │  │ Prometheus/Grafana/  │  │
│  │ (failure injection)│       │ PostgreSQL │  │(cache,   │  │ Loki / OTel Collector │  │
│  └───────────────────┘        └────────────┘  │ idem,DLQ)│  └──────────────────────┘  │
│                                                └──────────┘                            │
│  ┌───────────────────────────── Frontend (React operator console) ─────────────────┐ │
│  └──────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Service Responsibilities & Boundaries

| Service | Owns | Data store | Sync API | Consumes events | Produces events |
| ------- | ---- | ---------- | -------- | --------------- | --------------- |
| **Channel Gateway** | Webhook ingestion, provider auth, normalization, inbound idempotency | Redis (idempotency keys) | `POST /webhooks/*` | — | `message.received` |
| **Conversation Service** | Conversations, messages, lifecycle state | MongoDB | `/conversations*` | `message.received`, `routing.completed`, `message.sent` | `conversation.created`, `conversation.updated`, `message.send.requested`, `conversation.resolved` |
| **Customer Service** | Customer profiles, external identities, identity resolution | PostgreSQL | `/customers*` | `message.received` | `customer.identified`, `customer.created` |
| **AI Service** | Intent, sentiment, entities, summary | — (stateless; mock LLM) | `/analyze` | `conversation.created` | `ai.analysis.completed` |
| **Routing Service** | Explainable routing, priority, handoff decision | PostgreSQL (rules) | `/route` | `ai.analysis.completed` | `routing.completed`, `conversation.assigned` |
| **Outbound Service** | Reliable outbound delivery (retry, backoff, breaker, DLQ) | Redis | — | `message.send.requested` | `message.sent`, `message.delivery.failed` |
| **Analytics Service** | Business & technical metrics aggregation | (in-memory / Mongo) | `/analytics*` | _all_ events | — |
| **Incident Simulator** | Controlled failure injection & incident lifecycle | PostgreSQL / Redis | `/incidents*` | — | `incident.started`, `incident.ended` |

> The **ownership rule**: a piece of data has exactly one owning service. Others read it through APIs or by
> subscribing to events — never by reaching into another service's database.

---

## 5. The Canonical Event Envelope

Every event on the bus shares one envelope (details & versioning in
[`docs/events/event-catalog.md`](../events/event-catalog.md)):

```jsonc
{
  "eventId": "evt_123",          // globally unique, idempotency at consumer level
  "eventType": "message.received",
  "version": 1,                   // schema version for this eventType
  "occurredAt": "2026-07-25T12:00:00.000Z",
  "correlationId": "corr_123",    // ties together one logical customer interaction
  "traceId": "trace_123",         // distributed trace id (OTel-compatible)
  "source": "channel-gateway",    // producing service
  "payload": { /* type-specific, Zod-validated */ }
}
```

The **canonical inbound message** produced by the gateway hides all provider specifics:

```jsonc
{
  "eventType": "message.received",
  "channel": "whatsapp",          // one of the supported channels
  "externalMessageId": "wa_msg_123",
  "externalConversationId": "wa_conv_123",
  "sender": { "externalId": "+5491112345678", "displayName": "Customer" },
  "content": { "type": "text", "text": "No puedo pagar mi factura" },
  "occurredAt": "2026-07-25T12:00:00.000Z",
  "metadata": {}
}
```

---

## 6. End-to-End Message Lifecycle (happy path)

```text
 1. Customer sends "No puedo pagar mi factura" on WhatsApp
 2. WhatsApp Provider Simulator POSTs a provider-shaped webhook to Channel Gateway
 3. Gateway: validate signature → WhatsAppAdapter.parseInboundEvent → canonical message
 4. Gateway: idempotency check on (channel, externalMessageId) via Redis
 5. Gateway: publish `message.received` to NATS  (responds 200 to provider fast)
 6. Customer Service: resolves/creates customer → `customer.identified`
 7. Conversation Service: creates/opens conversation, persists message → `conversation.created`
 8. AI Service: classify intent=billing, sentiment=negative, confidence=0.91 → `ai.analysis.completed`
 9. Routing Service: rules + AI → team=billing, priority=4, reason=[...] → `routing.completed`
10. Conversation Service: records assignment; bot or human answers
11. Conversation Service: emits `message.send.requested`
12. Outbound Service: WhatsAppAdapter.sendMessage via simulator
        (timeout • retry w/ backoff+jitter • circuit breaker • DLQ on exhaustion)
13. Outbound Service: `message.sent` (or `message.delivery.failed`)
14. Analytics Service: updates metrics on every event above
15. Observability: one traceId visible across all logs; metrics scraped by Prometheus
```

The **same `traceId`** appears in every service log line, so the flow is reconstructable end-to-end.

---

## 7. Synchronous vs Asynchronous Communication

- **Asynchronous (event bus)** is the default for cross-service workflow steps. It decouples producers from
  consumers, absorbs bursts, and lets us simulate backlog and event loss. See
  [ADR-001](../adr/ADR-001-event-driven-architecture.md).
- **Synchronous (HTTP)** is used for:
  - external providers ↔ gateway (webhooks are inherently request/response),
  - the frontend ↔ services (queries, incident control),
  - a few read-time lookups where an immediate answer is required.

---

## 8. Cross-Cutting Concerns

| Concern | Where it lives | Reference |
| ------- | -------------- | --------- |
| **Idempotency** | Gateway (inbound) + consumers (eventId) + DB unique indexes | [ADR-004](../adr/ADR-004-idempotency-strategy.md) |
| **Retries / Timeouts / Circuit Breaker** | Outbound Service; shared resilience utilities | [ADR-006](../adr/ADR-006-retry-and-circuit-breaker.md) |
| **Reliable publishing (Outbox)** | Conversation Service (at least one flow) | [ADR-005](../adr/ADR-005-outbox-pattern.md), [outbox-pattern.md](outbox-pattern.md) |
| **Rate limiting** | Gateway + provider simulators | Redis token buckets |
| **Observability** | All services (`/health`, `/ready`, `/metrics`, structured logs, traces) | [ADR-007](../adr/ADR-007-observability-strategy.md) |
| **Validation** | Zod schemas in `packages/shared` | [ADR-002](../adr/ADR-002-channel-adapter-boundaries.md) |
| **Database selection** | Per-service store choice | [ADR-003](../adr/ADR-003-database-selection.md) |

---

## 9. Failure Model (what we deliberately simulate)

> "A system can be technically healthy but functionally degraded."

- A timeout does **not** imply the operation failed (→ duplicates on retry).
- A retry can duplicate an operation (→ idempotency required).
- An event can be lost between DB commit and publish (→ outbox).
- A provider can be partially available (→ circuit breaker, fallback).
- A database can be alive but extremely slow (→ p95 latency, pool exhaustion).
- A queue can grow with zero errors (→ backpressure, queue-depth metrics).
- An API can return HTTP 200 while the business fails (→ semantic monitoring).
- An LLM can return invalid JSON (→ strict validation, human fallback).

Each of these maps to a concrete incident in the [Incident Simulation Engine](../incidents/README.md).

---

## 10. Deployment Topology (local)

Everything runs via **Docker Compose** (Phase 1). Each Node service is an independent container with its own
`Dockerfile`; infrastructure (Mongo, Postgres, Redis, NATS, Prometheus, Grafana, Loki, optional OTel
Collector) runs as sibling containers on a shared network. Ports are listed in the
[README service map](../../README.md#-service--port-map).

---

## 11. Related Documents

- [ADR index](../adr/) — the "why" behind each decision.
- [Event catalog](../events/event-catalog.md) — every event type and version.
- [Outbox pattern](outbox-pattern.md) — reliable publishing deep-dive.
- [Runbooks](../runbooks/) — operational responses.
- [Incident postmortems](../incidents/) — INC-001 … INC-006.
- [Scalability notes](../scalability/) — where this design would bend and how to scale it.
