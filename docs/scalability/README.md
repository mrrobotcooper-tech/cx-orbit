# Scalability Notes

> **Status:** Phase 14 — design + lab observations from the running Compose stack.

CX-ORBIT is a local lab, but every component has an **explainable scaling path**. This document
records where the design bends under load and how it would grow in production.

## Observed lab signals

| Signal | How we see it | Incident / demo |
| ------ | ------------- | --------------- |
| Consumer lag | Analytics / Prometheus lag gauges | INC-003 flood |
| Outbox pending | `conversation_outbox_pending` | INC-006 drop |
| Delivery failures | Outbound metrics + DLQ size | INC-002 timeout |
| Handler latency | Conversation duration + logs | INC-004 DB delay |
| AI fallback rate | AI metrics / containment | INC-005 invalid JSON |
| Duplicate rate | Gateway/conversation `duplicate` counters | INC-001 |

These are the same dials an on-call engineer would watch — the lab just makes them easy to spike.

## Where the bottlenecks are

| Component | First bottleneck | Scaling approach |
| --------- | ---------------- | ---------------- |
| **Channel Gateway** | CPU on validation; provider retry storms | Horizontal scale (stateless); shared Redis idempotency; per-provider rate limits. |
| **NATS JetStream** | Consumer throughput < ingest → backlog | Scale durable consumers, partition subjects, tune max-deliver, shed at gateway. |
| **Conversation (Mongo)** | Write throughput, hot threads | Shard by conversation id, indexes, read replicas; keep outbox in the same transaction. |
| **Customer (Postgres)** | Identity lookups, pool exhaustion | Indexes, PgBouncer, Redis cache for hot `(channel, externalId)`. |
| **AI Service** | Provider latency / rate limits | Horizontal workers, cache, breaker, degrade to mock/fallback (already modeled). |
| **Outbound** | Provider limits, retry amplification | Per-channel concurrency, breaker, DLQ, backoff+jitter (ADR-006). |
| **Analytics** | Event volume on the read path | Consumer groups, pre-aggregation, separate store for long retention. |
| **Outbox relay** | Polling overhead at scale | Graduate to CDC (Debezium) — documented, not implemented (ADR-005). |

## Stateless vs stateful

- **Stateless (scale freely):** Gateway, AI, Routing, Outbound workers, Analytics consumers, Frontend, Incident API.
- **Stateful (scale with product mechanisms):** Mongo, Postgres, Redis, JetStream.

## Backpressure & load shedding

Queue depth / consumer lag are first-class. When lag grows (INC-003), the correct response is **scale
consumers or shed at the edge** — not silent latency explosion.

## Cost/complexity boundaries (intentional)

Kept out of the laptop lab on purpose, but documented so the trade-off is interview-ready:

- CDC-based outbox, multi-region, HPA/autoscaling, service mesh, multi-tenant isolation.
- Real LLM providers (interface ready via ADR-008; mock is default).
