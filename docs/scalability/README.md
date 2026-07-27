# Scalability Notes

> **Status:** Phase 0 (design notes). Expanded in Phase 14 with measurements from the running system.

CX-ORBIT is a local lab, but every component is designed so its **scaling path is explainable**. This document
records where the current design would bend under load and how it would scale.

## Where the bottlenecks are

| Component | First bottleneck | Scaling approach |
| --------- | ---------------- | ---------------- |
| **Channel Gateway** | CPU on validation/normalization; provider retry storms | Horizontal scale (stateless); idempotency in Redis is shared; rate-limit per provider. |
| **Event Bus (NATS JetStream)** | Consumer throughput < ingest rate → backlog (INC-003) | Scale consumers, partition by subject, tune ack/max-deliver, apply backpressure. |
| **Conversation Service (Mongo)** | Write throughput, hot conversations | Sharding by conversationId, proper indexes, read replicas. |
| **Customer Service (Postgres)** | Identity-resolution queries, connection pool (INC-004) | Indexes, connection pooling (PgBouncer), caching hot lookups in Redis. |
| **AI Service** | External LLM latency/rate limits | Horizontal scale (stateless), request batching, caching, circuit breaker, degrade to mock. |
| **Outbound Service** | Provider limits, retry amplification | Per-provider concurrency limits, circuit breaker, DLQ, backoff+jitter (ADR-006). |
| **Analytics Service** | Event volume on the read side | Consumer groups, pre-aggregation, windowing, separate store. |
| **Outbox Publisher** | Polling overhead at scale | Switch polling → CDC (Debezium) tailing the WAL. |

## Stateless vs stateful

- **Stateless (scale horizontally freely):** Gateway, AI, Routing, Outbound workers, Analytics consumers, Frontend.
- **Stateful (scale with care):** Mongo, Postgres, Redis, NATS JetStream — scale via their own mechanisms
  (sharding, replicas, clustering).

## Backpressure & load shedding

- Queue depth is a first-class metric; when it grows, we scale consumers or shed load at the gateway (429 +
  provider retry) rather than letting latency explode silently (INC-003).

## Cost/complexity boundaries (intentional)

Some production techniques are **documented but not implemented** to keep the lab runnable on a laptop:
CDC-based outbox, multi-region, autoscaling, service mesh. Each is noted where relevant so the trade-off is
explicit and defensible.
