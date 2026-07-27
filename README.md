<div align="center">

# CX-ORBIT

### Multichannel Contact Center & Distributed Systems Incident Simulation Platform

_A realistic engineering laboratory that simulates an enterprise-grade, event-driven Contact Center — built to demonstrate distributed systems patterns, resilience engineering, observability, and production incident response._

</div>

---

> **Project status:** 🟡 **Phase 3 — Channel Gateway**. Phases 0–2 (architecture, infrastructure, core event
> model) are complete. See the [Implementation Roadmap](#-implementation-roadmap) for what lands in each phase.

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
```

A detailed walkthrough with C4-style diagrams, service boundaries and the message lifecycle lives in
[`docs/architecture/overview.md`](docs/architecture/overview.md).

---

## 🧱 Tech Stack

| Layer            | Technology                                                              |
| ---------------- | ---------------------------------------------------------------------- |
| Backend runtime  | **Node.js 20+** + **TypeScript** (strict mode)                         |
| HTTP framework   | **Fastify**                                                            |
| Validation       | **Zod** (contracts & event schemas)                                    |
| Logging          | **Pino** (structured JSON logs)                                        |
| Event bus        | **NATS JetStream** (see [ADR-001](docs/adr/ADR-001-event-driven-architecture.md)) |
| Document store   | **MongoDB** (conversations, messages)                                  |
| Relational store | **PostgreSQL** (users, agents, teams, routing rules, config, incidents)|
| Cache / locks    | **Redis** (cache, idempotency keys, rate limiting, distributed locks)  |
| Testing          | **Vitest** (unit + integration + e2e)                                  |
| Frontend         | **React** + **Vite** + **React Router** + **TanStack Query** + **Zustand** + **Recharts** + **Tailwind CSS** |
| Observability    | **Prometheus** • **Grafana** • **Loki** • **OpenTelemetry** (optional) |
| Orchestration    | **Docker Compose**                                                     |
| Monorepo         | **pnpm workspaces**                                                    |

---

## 📁 Repository Structure

```text
CX-ORBIT/
├── packages/
│   └── shared/               # Canonical events, contracts, Zod schemas, shared utils (Phase 2)
├── services/
│   ├── channel-gateway/      # Inbound webhooks → canonical events (Phase 3)
│   ├── conversation-service/ # Conversations & messages (MongoDB) (Phase 4)
│   ├── customer-service/     # Customer profiles & identity resolution (PostgreSQL) (Phase 5)
│   ├── ai-service/           # Intent / sentiment / entities / summary (Phase 6)
│   ├── routing-service/      # Explainable routing & priority (Phase 7)
│   ├── outbound-service/     # Outbound delivery: retries, breaker, DLQ (Phase 8)
│   ├── analytics-service/    # Business & technical metrics (Phase 9)
│   └── incident-simulator/   # Controlled incident injection engine (Phase 10)
├── simulators/               # Fake external provider APIs (Phase 3 & 8)
│   ├── whatsapp-provider/  telegram-provider/  email-provider/
│   ├── instagram-provider/ facebook-provider/  x-provider/
│   └── webchat-provider/
├── frontend/                 # React operator console (Phase 11)
├── infra/                    # Prometheus, Grafana, Loki, OTel configs (Phase 1)
├── docs/
│   ├── architecture/         # Overview, C4 diagrams, patterns
│   ├── adr/                  # Architecture Decision Records (10 mandatory)
│   ├── api/                  # Per-service API references
│   ├── events/               # Canonical event catalog & versioning
│   ├── incidents/            # Postmortems (INC-001 … INC-006)
│   ├── runbooks/             # Operational runbooks
│   ├── scalability/          # Scaling notes & bottleneck analysis
│   └── development/          # Local dev, conventions, contributing
├── scripts/                  # Dev & ops helper scripts
├── docker-compose.yml        # Full local stack (Phase 1)
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## 🚀 Quick Start

> ⚠️ **Phase 0 note:** the commands below describe the **target** developer experience. Infrastructure
> (`docker compose up`) becomes functional in **Phase 1**, and services come online in later phases.

### Prerequisites

- Node.js **>= 20**
- pnpm **>= 9** (`npm install -g pnpm`)
- Docker + Docker Compose v2

### Install

```bash
pnpm install
```

### Bring up infrastructure (Phase 1+)

```bash
cp .env.example .env
docker compose up -d          # Mongo, Postgres, Redis, NATS, Prometheus, Grafana, Loki
```

### Run the platform (later phases)

```bash
pnpm dev                      # all services in watch mode
pnpm --filter channel-gateway dev   # a single service
```

### Test

```bash
pnpm test                     # all tests
pnpm test:unit                # unit only
pnpm test:integration         # requires infra up
pnpm test:e2e                 # full flow
```

### Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm format:check
```

---

## 🔌 Service & Port Map

> Ports are configurable via `.env`. Defaults below.

| Component                | Default Port | Store / Notes                          |
| ------------------------ | ------------ | -------------------------------------- |
| Frontend (operator UI)   | `3000`       | React + Vite                           |
| Channel Gateway          | `8080`       | Inbound webhooks                       |
| Conversation Service     | `8081`       | MongoDB                                |
| Customer Service         | `8082`       | PostgreSQL                             |
| AI Service               | `8083`       | Mock provider by default               |
| Routing Service          | `8084`       | PostgreSQL (rules)                     |
| Outbound Service         | `8085`       | Redis (DLQ, breaker state)             |
| Analytics Service        | `8086`       | Event consumer                         |
| Incident Simulator       | `8087`       | Controls failure injection            |
| WhatsApp Provider (sim)  | `9101`       | Fake external API                      |
| Telegram Provider (sim)  | `9102`       | Fake external API                      |
| Email Provider (sim)     | `9103`       | Fake external API                      |
| Instagram Provider (sim) | `9104`       | Fake external API                      |
| Facebook Provider (sim)  | `9105`       | Fake external API                      |
| X Provider (sim)         | `9106`       | Fake external API                      |
| WebChat Provider (sim)   | `9107`       | Fake external API                      |
| MongoDB                  | `27017`      | Infra                                  |
| PostgreSQL               | `5432`       | Infra                                  |
| Redis                    | `6379`       | Infra                                  |
| NATS (JetStream)         | `4222`/`8222`| Event bus / monitoring                 |
| Prometheus               | `9090`       | Metrics                                |
| Grafana                  | `3001`       | Dashboards                             |
| Loki                     | `3100`       | Log aggregation                        |

Every backend service exposes `/health`, `/ready` and `/metrics`.

---

## 🩺 Observability

- **Structured JSON logs** with `correlationId`, `traceId` and `conversationId` on every request.
- **Prometheus metrics** for latency, error rate, throughput, queue depth, circuit-breaker state, provider health.
- **Grafana dashboards** for technical and business metrics.
- **Loki** for centralized log querying.
- **OpenTelemetry** tracing (optional, toggled with `OTEL_ENABLED`).

The message lifecycle is traceable end-to-end using a single `traceId` across all services.

---

## 🔥 Incident Simulation

CX-ORBIT ships an **Incident Simulation Engine** that injects controlled, realistic failures:

| Incident | Theme |
| -------- | ----- |
| **INC-001** | Duplicate Messages (idempotency) |
| **INC-002** | Provider Timeout (retry / backoff / circuit breaker) |
| **INC-003** | Queue Backlog (backpressure) |
| **INC-004** | Database Latency (slow queries, pool exhaustion) |
| **INC-005** | AI Invalid Response (output validation, fallback) |
| **INC-006** | Event Loss (outbox, reconciliation) |

Each incident has: a way to trigger it, observable symptoms (metrics + logs), a diagnosis path, a fix, a
**regression test**, a [runbook](docs/runbooks/) and a [postmortem](docs/incidents/).

---

## 🗺️ Implementation Roadmap

| Phase | Deliverable | Status |
| ----- | ----------- | ------ |
| **0** | Architecture: README, overview, ADRs, repo scaffold | ✅ Done |
| **1** | Infrastructure: Docker Compose (Mongo, Postgres, Redis, NATS, Prometheus, Grafana, Loki) | ✅ Done |
| **2** | Core event model: shared contracts, event envelope, canonical message, validation | ✅ Done |
| **3** | Channel Gateway: webhooks, validation, normalization, idempotency, publishing | 🟡 In progress |
| **4** | Conversation Service | ⬜ Planned |
| **5** | Customer Service (identity resolution) | ⬜ Planned |
| **6** | AI Service (mock provider) | ⬜ Planned |
| **7** | Routing Service (explainable) | ⬜ Planned |
| **8** | Outbound Messaging (adapters, retries, circuit breaker) | ⬜ Planned |
| **9** | Analytics Service | ⬜ Planned |
| **10** | Incident Simulator | ⬜ Planned |
| **11** | Frontend operator console | ⬜ Planned |
| **12** | Testing (unit, integration, contract, e2e, failure) | ⬜ Planned |
| **13** | CI/CD (GitHub Actions) | ⬜ Planned |
| **14** | Final documentation (runbooks, postmortems, scalability, walkthrough) | ⬜ Planned |

Full phase details and per-phase acceptance criteria: [`docs/development/roadmap.md`](docs/development/roadmap.md).

---

## 📚 Documentation Index

- [Architecture Overview](docs/architecture/overview.md)
- [Architecture Decision Records (ADRs)](docs/adr/)
- [Canonical Event Catalog](docs/events/event-catalog.md)
- [Runbooks](docs/runbooks/)
- [Incident Postmortems](docs/incidents/)
- [Scalability Notes](docs/scalability/)
- [Development Guide & Roadmap](docs/development/)

---

## 📝 License

Portfolio / educational project. See repository owner for usage terms.
