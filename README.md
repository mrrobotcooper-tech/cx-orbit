<div align="center">

# CX-ORBIT

### Multichannel Contact Center & Distributed Systems Incident Simulation Platform

_A realistic engineering laboratory that simulates an enterprise-grade, event-driven Contact Center — built to demonstrate distributed systems patterns, resilience engineering, observability, and production incident response._

</div>

---

> **Project status:** ✅ **Complete (Phases 0–14)** — platform, incidents, operator UI, tests and CI.
> See the [Implementation Roadmap](#-implementation-roadmap) and the
> [Interview Walkthrough](docs/interview/walkthrough.md).

---

## 📖 What is CX-ORBIT?

CX-ORBIT is a **simulated** omnichannel Customer Experience / Contact Center platform. Customers start
conversations through Email, Web Chat, WhatsApp, Telegram, Instagram, Facebook Messenger and X/Twitter.
Each inbound event is normalized to a **canonical model**, processed by a set of **microservices**
communicating over an **event bus**, enriched by an **AI service**, routed to a bot or a human agent, and
finally answered through an **outbound channel adapter**.

It is deliberately **not a CRUD app**. Its purpose is to make distributed-systems concerns _visible,
observable and testable_:

- Event-driven architecture with a canonical event model and event versioning.
- Synchronous and asynchronous communication.
- External provider integration isolated behind **adapters** and **provider simulators**.
- Partial failures, idempotency, retries, timeouts, exponential backoff + jitter.
- Circuit breakers, rate limiting and dead-letter queues.
- The **Outbox Pattern** for reliable event publishing.
- Full observability: structured logs, Prometheus metrics, Grafana dashboards, Loki, optional OpenTelemetry traces.
- AI/LLM orchestration with strict output validation and human handoff.
- A built-in **Incident Simulation Engine** to reproduce real production failures on demand, each with
  detection → diagnosis → mitigation → fix → regression test → postmortem.

> The guiding principle: every technical decision must be **explainable, observable, testable, reproducible,
> documented and defensible in a technical interview.**

---

## 🏛️ High-Level Architecture

```text
 External Channel (customer)
        │
        ▼
 Provider Simulator ──────────────┐  (simulates WhatsApp / Telegram / Email / ... APIs:
        │                         │   latency, timeouts, rate limits, duplicates, 500s)
        ▼                         │
 Channel Adapter (inbound)        │
        │                         │
        ▼                         │
 Channel Gateway ─────────────────┘
        │  (validate • authenticate webhook • correlationId • idempotency • normalize)
        ▼
 Canonical Event  ──►  Event Bus (NATS JetStream)
        │
        ├─────────────► Conversation Service ──► MongoDB
        ├─────────────► Customer Service     ──► PostgreSQL
        ├─────────────► AI Service           ──► intent • sentiment • entities • summary
        ├─────────────► Routing Service      ──► team • priority • explainable reason
        │                        │
        │                        ▼
        │              Bot  or  Human Agent (handoff)
        │                        │
        ▼                        ▼
 Analytics Service        Outbound Message Service
 (business + tech            │ (timeout • retry • backoff+jitter • circuit breaker • DLQ)
  metrics)                   ▼
        │            Outbound Channel Adapter ──► Provider Simulator ──► Delivery Result
        ▼
 Observability (Prometheus • Grafana • Loki • OpenTelemetry)
        ▲
 Incident Simulator (Redis fault flags + event injection)
 Operator Console (React) ──REST──► services
```

Details: [`docs/architecture/overview.md`](docs/architecture/overview.md).

---

## 🧱 Tech Stack

| Layer            | Technology                                                              |
| ---------------- | ---------------------------------------------------------------------- |
| Backend runtime  | **Node.js 20+** + **TypeScript** (strict mode)                         |
| HTTP framework   | **Fastify**                                                            |
| Validation       | **Zod** (contracts & event schemas)                                    |
| Logging          | **Pino** (structured JSON logs)                                        |
| Event bus        | **NATS JetStream** ([ADR-001](docs/adr/ADR-001-event-driven-architecture.md)) |
| Document store   | **MongoDB** (conversations, messages, outbox)                          |
| Relational store | **PostgreSQL** (customers, routing decisions)                          |
| Cache / locks    | **Redis** (idempotency, fault flags, DLQ)                              |
| Testing          | **Vitest** (unit + integration + contract + e2e)                       |
| Frontend         | **React** + **Vite** + **Router** + **TanStack Query** + **Zustand** + **Recharts** + **Tailwind** |
| Observability    | **Prometheus** • **Grafana** • **Loki** • **OpenTelemetry** (optional) |
| CI               | **GitHub Actions** (lint, typecheck, unit, integration, Docker builds) |
| Monorepo         | **pnpm workspaces**                                                    |

---

## 🚀 Quick Start

### Prerequisites

- Node.js **>= 20**
- pnpm **>= 9** (`corepack enable` recommended)
- Docker + Docker Compose v2

### Install & infra

```bash
pnpm install
cp .env.example .env
pnpm infra:up                 # Mongo (RS), Postgres, Redis, NATS, Prometheus, Grafana, Loki
```

> Postgres on the host may be mapped to **5433** if 5432 is taken — see `.env` / `POSTGRES_URL`.

### Run services (one terminal each)

```bash
pnpm --filter @cx-orbit/channel-gateway dev
pnpm --filter @cx-orbit/conversation-service dev
pnpm --filter @cx-orbit/customer-service dev
pnpm --filter @cx-orbit/ai-service dev
pnpm --filter @cx-orbit/routing-service dev
pnpm --filter @cx-orbit/outbound-service dev
pnpm --filter @cx-orbit/analytics-service dev
pnpm --filter @cx-orbit/incident-simulator dev
pnpm --filter @cx-orbit/webchat-provider dev
pnpm --filter @cx-orbit/frontend dev          # http://localhost:3000
```

Rebuild platform after pulling API changes: `pnpm --filter @cx-orbit/platform build`.

### Success checklist

```bash
# 1) Health
for p in 8080 8081 8082 8083 8084 8085 8086 8087; do curl -sf http://localhost:$p/health; done

# 2) Inbound smoke (webchat)
curl -s -X POST http://localhost:8080/webhooks/webchat \
  -H 'content-type: application/json' \
  -d '{"sessionId":"s1","messageId":"wc_demo_1","from":{"id":"u1","name":"Ana"},"text":"hola factura"}'

# 3) Analytics
curl -s http://localhost:8086/summary | jq .

# 4) Incident round-trip
curl -s -X POST http://localhost:8087/incidents/start \
  -H 'content-type: application/json' \
  -d '{"code":"INC-002","durationSeconds":20}' | jq .
curl -s -X POST http://localhost:8087/incidents/stop-all | jq .

# 5) Tests
pnpm test:unit
# with infra:  RUN_INTEGRATION=1 pnpm test:integration
# full stack:  RUN_E2E=1 pnpm test:e2e

# 6) Or the helper script
bash scripts/success-checklist.sh
```

Operator UI: [http://localhost:3000](http://localhost:3000) · Grafana: [http://localhost:3001](http://localhost:3001)

### Quality gates / CI locally

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
bash scripts/docker-build-all.sh   # optional; also runs in GitHub Actions
```

---

## 🔌 Service & Port Map

| Component                | Default Port | Store / Notes                          |
| ------------------------ | ------------ | -------------------------------------- |
| Frontend (operator UI)   | `3000`       | React + Vite (`/svc/*` proxy)          |
| Channel Gateway          | `8080`       | Inbound webhooks                       |
| Conversation Service     | `8081`       | MongoDB + outbox                       |
| Customer Service         | `8082`       | PostgreSQL                             |
| AI Service               | `8083`       | Mock provider by default               |
| Routing Service          | `8084`       | Explainable decisions                  |
| Outbound Service         | `8085`       | Retry / breaker / DLQ                  |
| Analytics Service        | `8086`       | Event consumer + `/summary`            |
| Incident Simulator       | `8087`       | INC-001…006                            |
| WebChat Provider (sim)   | `9107`       | Outbound fault injection               |
| MongoDB                  | `27017`      | Replica set `rs0`                      |
| PostgreSQL               | `5432`/`5433`| Host map via `.env`                    |
| Redis                    | `6379`       | Idempotency + faults                   |
| NATS (JetStream)         | `4222`/`8222`| Bus / monitoring                       |
| Prometheus               | `9090`       | Metrics                                |
| Grafana                  | `3001`       | Dashboards                             |
| Loki                     | `3100`       | Logs                                   |

Every backend service exposes `/health`, `/ready` and `/metrics`.

---

## 🔥 Incident Simulation

| Incident | Theme |
| -------- | ----- |
| **INC-001** | Duplicate Messages (idempotency) |
| **INC-002** | Provider Timeout (retry / backoff / circuit breaker) |
| **INC-003** | Queue Backlog (backpressure) |
| **INC-004** | Database Latency (slow queries) |
| **INC-005** | AI Invalid Response (validation + fallback) |
| **INC-006** | Event Loss (outbox / reconciliation) |

Each incident: triggerable, observable, stoppable, with [runbook](docs/runbooks/) + [postmortem](docs/incidents/) + regression tests.

---

## 🗺️ Implementation Roadmap

| Phase | Deliverable | Status |
| ----- | ----------- | ------ |
| **0** | Architecture, ADRs, repo scaffold | ✅ |
| **1** | Docker Compose infra + observability | ✅ |
| **2** | Shared event model | ✅ |
| **3** | Channel Gateway + adapters | ✅ |
| **4** | Conversation Service + outbox | ✅ |
| **5** | Customer Service | ✅ |
| **6** | AI Service | ✅ |
| **7** | Routing Service | ✅ |
| **8** | Outbound + resilience + webchat sim | ✅ |
| **9** | Analytics + Grafana business | ✅ |
| **10** | Incident Simulator | ✅ |
| **11** | Frontend operator console | ✅ |
| **12** | Testing tiers | ✅ |
| **13** | CI/CD (GitHub Actions + Docker) | ✅ |
| **14** | Final documentation | ✅ |

Details: [`docs/development/roadmap.md`](docs/development/roadmap.md).

---

## 📚 Documentation Index

- [Architecture Overview](docs/architecture/overview.md)
- [Interview Walkthrough](docs/interview/walkthrough.md)
- [Architecture Decision Records](docs/adr/)
- [API Reference](docs/api/)
- [Event Catalog](docs/events/event-catalog.md)
- [Runbooks](docs/runbooks/)
- [Incident Postmortems](docs/incidents/)
- [Scalability Notes](docs/scalability/)
- [Testing Guide](docs/development/testing.md)
- [Development Guide & Roadmap](docs/development/)

---

## 📝 License

Portfolio / educational project. See repository owner for usage terms.
