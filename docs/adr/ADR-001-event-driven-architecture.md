# ADR-001 — Event-Driven Architecture with NATS JetStream

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** Distributed Systems Architect, Backend Engineer, SRE

## Context

CX-ORBIT ingests messages from many channels and must process each through several independent steps
(customer resolution, conversation persistence, AI analysis, routing, outbound delivery, analytics). These
steps have different latencies and failure modes. We want:

- loose coupling between steps so one slow/failing step does not block the rest;
- the ability to add consumers (e.g. analytics) without touching producers;
- natural places to **simulate** backlog, retries and event loss;
- persistence so a restarted consumer can resume;
- something **lightweight** that runs locally with Docker Compose.

## Decision

Use an **event-driven architecture** with an **event bus as the primary integration mechanism** between
services, and use **NATS JetStream** as that bus.

- Services publish **canonical events** (shared envelope, Zod-validated) and subscribe to the ones they care about.
- Synchronous HTTP is reserved for webhooks (provider → gateway), frontend queries, and a few read-time lookups.
- JetStream provides durable streams, consumers with acknowledgements, redelivery, and max-deliver limits
  (which feed our DLQ and retry story).

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| **RabbitMQ** | Excellent and viable. Heavier to operate locally; routing model (exchanges/bindings) is more ceremony than we need. Would be documented here if chosen. |
| **Apache Kafka** | Powerful but operationally heavy (ZooKeeper/KRaft, JVM footprint) for a local lab. Using it "to look enterprise" is explicitly rejected by the project brief. |
| **Redis Streams** | We already use Redis, but we want Redis focused on cache/idempotency/locks (see ADR-003), and JetStream has a richer consumer/ack model. |
| **Direct HTTP calls only (orchestration)** | Tight coupling, cascading failures, no natural backlog/replay, hard to simulate async failure modes. |

## Trade-offs

- **Pro:** decoupling, buffering, replay, easy fan-out, realistic async failure simulation, light local footprint.
- **Pro:** durable + at-least-once delivery gives us a reason to implement idempotency (ADR-004) — a core teaching goal.
- **Con:** at-least-once delivery means **duplicates are possible** → consumers must be idempotent.
- **Con:** eventual consistency across services; the frontend must tolerate "not yet processed" states.
- **Con:** debugging spans multiple services → mitigated by correlationId/traceId (ADR-007).

## Consequences

- Every event uses the shared envelope with `eventId`, `correlationId`, `traceId`, `version` (see event catalog).
- Consumers must be **idempotent** on `eventId` and on business keys (ADR-004).
- We can build the **Queue Backlog** (INC-003) and **Event Loss** (INC-006) incidents on top of this bus.
- The Outbox Pattern (ADR-005) bridges the DB-commit / event-publish gap safely.
- If we ever switch to RabbitMQ/Kafka, the canonical envelope + a thin bus adapter keep services unchanged.
