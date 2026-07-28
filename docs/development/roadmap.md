# Implementation Roadmap & Phase Acceptance Criteria

CX-ORBIT is built **incrementally**. Nothing is built all at once. Each phase has an explicit **goal**,
**deliverables** and **acceptance criteria** that must pass before moving on. After every phase we verify:
code compiles · typecheck passes · lint passes · tests pass · services start · no broken imports · contracts
consistent.

Legend: 🟡 in progress · ⬜ planned · ✅ done

---

## Phase 0 — Architecture 🟡

**Goal:** establish the repo, tooling, documentation and decisions before writing services.

**Deliverables**
- Monorepo scaffold (pnpm workspaces, `tsconfig.base.json`, ESLint, Prettier, `.gitignore`, `.env.example`).
- Full directory tree for services, simulators, packages, frontend, infra, docs.
- `README.md`, `docs/architecture/overview.md`, `docs/architecture/outbox-pattern.md`.
- 10 ADRs (ADR-001 … ADR-010).
- Doc stubs: event catalog, incidents index, runbooks index, scalability, api, development guide, this roadmap.

**Acceptance criteria**
- [ ] Repo structure matches the README.
- [ ] All 10 ADRs present with Context/Decision/Alternatives/Trade-offs/Consequences.
- [ ] Documentation cross-links resolve.
- [ ] `pnpm install` succeeds at the root (once dependencies are added).

---

## Phase 1 — Infrastructure ✅

**Goal:** everything the platform needs starts with one command.

**Deliverables:** `docker-compose.yml` with MongoDB, PostgreSQL, Redis, NATS JetStream, Prometheus, Grafana,
Loki, Promtail (and optional OTel Collector); provisioning configs under `infra/`; `scripts/verify-infra.sh`.

**Acceptance criteria**
- [x] `docker-compose.yml` validates (`docker compose config -q`).
- [x] `docker compose up -d` brings all infra healthy.
- [x] Mongo/Postgres/Redis reachable; NATS JetStream enabled (`/jsz`).
- [x] Prometheus scrapes itself; Grafana loads provisioned datasources + dashboard; Loki receives logs via Promtail.
- [x] `bash scripts/verify-infra.sh` passes (10/10).
- [x] Documented ports match the README.

---

## Phase 2 — Core Event Model ✅

**Goal:** the shared contract every service depends on.

**Deliverables:** `packages/shared` with event envelope, canonical inbound message, all event types, Zod
schemas + inferred TS types, and validation helpers.

**Acceptance criteria**
- [x] `packages/shared` builds and is importable by workspaces.
- [x] Zod schemas validate the sample payloads in the event catalog.
- [x] Unit tests cover envelope + each event schema (valid + invalid cases) — 28 tests passing.
- [x] Event catalog and code are consistent.

---

## Phase 3 — Channel Gateway ✅

**Goal:** turn provider webhooks into canonical events, safely.

**Deliverables:** Fastify service with `POST /webhooks/:channel` for all 7 channels
(`webchat, whatsapp, telegram, email, instagram, facebook, x`), webhook validation, normalization via
adapters, **idempotency** on `(channel, externalMessageId)`, publish `message.received`.

**Status:** `@cx-orbit/platform` runtime kit + `@cx-orbit/channel-gateway` implemented (7 adapters, ingest
pipeline, webhook route, RED + domain metrics). Typecheck/build/lint/format green; **19 unit tests passing**
and **E2E verified against live infra** (202/200/400/404, metrics incrementing, Redis idempotency keys
present, `/ready` OK). Provider simulators deferred to Phase 12.

**Acceptance criteria**
- [x] A simulated WhatsApp/WebChat webhook produces a valid `message.received` on NATS.
- [x] Duplicate webhook → single logical event (idempotent), verified by test + E2E.
- [x] Invalid payloads rejected (400) and logged with correlationId.
- [x] `/health`, `/ready`, `/metrics` present.
- [x] `pnpm test` (gateway) green on host + E2E verified against live infra.
- [ ] Provider simulators (deferred to Phase 12).

---

## Phase 4 — Conversation Service ✅

**Goal:** system of record for conversations & messages, with the Outbox Pattern.

**Deliverables:** Mongo-backed conversations/messages; REST (`/conversations*`) with pagination + filters;
lifecycle states; consumes `message.received`/`routing.completed`; emits `conversation.*` via **outbox**.

**Status:** Implemented and verified E2E. Mongo runs as a single-node replica set (ACID transactions);
platform gained `connectMongo` + a durable JetStream consumer (`startEventConsumer`) with backoff +
dead-letter. The service persists conversations/messages (unique `(channel, externalMessageId)` guard),
writes a transactional outbox drained by a relay, consumes `message.received`/`routing.completed`, and
exposes the REST API. Typecheck/build/lint/format green; **8/8 unit + integration tests passing**;
live E2E confirmed (conversation created, 2 messages, duplicate ignored, `outbox_published` per type,
`pending: 0`).

**Acceptance criteria**
- [x] A `message.received` creates/opens a conversation and persists the message.
- [x] List endpoint paginates and filters (channel/status/priority/assignedTeam/createdAt).
- [x] Outbox guarantees publish; integration test proves no lost event across a simulated crash.
- [x] Observability endpoints present.
- [x] Tests + E2E verified against live infra on host.

---

## Phase 5 — Customer Service ✅

**Goal:** identity resolution across channels.

**Deliverables:** Postgres-backed customer profiles + external identities; resolve/create on inbound; emits
`customer.identified`/`customer.created` via transactional outbox; REST list/get/resolve.

**Status:** Implemented and verified E2E. Platform gained `connectPostgres` + `withTransaction`. Service
resolves by unique `(channel, external_id)`, creates customer+identity atomically with outbox events,
and exposes `/customers*` + ops endpoints. Unit + integration tests **6/6**; live E2E confirmed (gateway
→ NATS → customer create → REST list + metrics; outbox `pending: 0`). Cross-channel merge (same person
on WhatsApp + webchat → one customer) remains a documented future extension.

**Acceptance criteria**
- [x] Resolve/create on inbound by `(channel, externalId)`; idempotent under redelivery.
- [ ] Same person across two channels → one customer (deferred: needs shared contact / merge API).
- [x] Unit + integration tests for create, idempotency, and outbox drain.
- [x] Observability endpoints present + E2E against live infra.

---

## Phase 6 — AI Service ✅

**Goal:** enrichment with strict validation and safe failure.

**Deliverables:** `AIProvider` interface + `MockAIProvider`; intent/sentiment/entities/summary; Zod-validated
output; emits `ai.analysis.completed`; simulate LOW_CONFIDENCE/INVALID_JSON/TIMEOUT/RATE_LIMIT/HALLUCINATION/PROVIDER_ERROR.

**Status:** Implemented and verified. Consumes `conversation.updated` (inbound + text), validates provider
output with Zod, falls back safely, publishes `ai.analysis.completed`, Redis idempotency, `POST /analyze`.
**15/15 unit tests**; live E2E confirmed (`analyses{ok}=4`, `ai.analysis.completed` published,
`conversation.updated` consumed).

**Acceptance criteria**
- [x] Runs with `AI_PROVIDER=mock`, no API keys.
- [x] Invalid model output never crashes the flow → rejected, logged, fallback path taken.
- [x] Unit tests cover valid + each failure mode.
- [x] Verified on host (typecheck/tests/E2E).

---

## Phase 7 — Routing ✅

**Goal:** explainable routing decisions.

**Deliverables:** rules + AI + priority + customer profile + channel + availability; emits `routing.completed`
with a `reason[]`; human handoff on low confidence.

**Status:** Implemented and verified. Pure `decideRoute` engine + Postgres rules/outbox/decisions; consumes
`ai.analysis.completed`; emits `routing.completed` + `conversation.assigned`; `POST /route`.
**7/7 unit tests**; live E2E confirmed (billing+negative → team/priority/reason; low confidence →
`LOW_AI_CONFIDENCE` handoff; outbox `routing.completed` + `conversation.assigned` published, `pending: 0`).

**Acceptance criteria**
- [x] Given intent/sentiment/customer, produces deterministic team + priority + reason.
- [x] Confidence < threshold → human handoff with full context.
- [x] Unit tests for rule combinations (no black box).
- [x] Verified on host (typecheck/tests/E2E).

---

## Phase 8 — Outbound Messaging ✅

**Goal:** reliable egress.

**Deliverables:** channel adapters + provider simulators; timeout, bounded retries, backoff+jitter, circuit
breaker (CLOSED/OPEN/HALF_OPEN), DLQ; metrics `provider_requests_total`, `provider_failures_total`,
`provider_latency_seconds`, `circuit_breaker_state`.

**Status:** Implemented and verified. Platform resilience kit; outbound-service with WebChat adapter + Redis
DLQ; webchat-provider simulator; conversation auto-emits `message.send.requested` after routing.
**18 platform + 5 outbound tests**; live E2E confirmed (`/send` → `sent`, simulator delivery, pipeline
auto-reply to billing team, `provider_requests_total{success}=2`, `message.sent` published).

**Acceptance criteria**
- [x] `message.send.requested` → delivery via simulator → `message.sent`.
- [x] Provider failure trips the breaker; no infinite retries; exhausted messages land in DLQ.
- [x] Unit tests for retry policy + breaker transitions.
- [x] Verified on host (typecheck/tests/E2E).

---

## Phase 9 — Analytics ⬜

**Goal:** business + technical metrics from the event stream.

**Deliverables:** event consumers computing messages/channel, conversations/hour, response/resolution times,
AI containment, handoff rate, error rate, provider latency; separated business vs technical metrics; dashboards.

**Acceptance criteria**
- [ ] Metrics update as events flow.
- [ ] Grafana dashboards render technical + business panels.
- [ ] Consumer keeps up under normal load; lag is observable.

---

## Phase 10 — Incident Simulator ⬜

**Goal:** inject controlled, observable failures.

**Deliverables:** `POST /incidents/start` etc.; implement INC-001..006 (duplicate messages, provider timeout,
queue backlog, database latency, AI invalid response, event loss); each modifies behavior, emits symptoms,
metrics, logs; can be disabled.

**Acceptance criteria**
- [ ] Each incident is triggerable and produces the documented symptoms.
- [ ] Each incident is diagnosable via metrics/logs and can be stopped.
- [ ] Each has before/after behavior and a regression test.

---

## Phase 11 — Frontend ⬜

**Goal:** a functional operator console consuming real APIs.

**Deliverables:** Dashboard, Conversations + Conversation view (AI analysis, timeline), Incident dashboard
(start/stop/details), Observability dashboard; React + Vite + Router + TanStack Query + Zustand + Recharts + Tailwind.

**Acceptance criteria**
- [ ] Dashboard shows live metrics from services.
- [ ] Can view a conversation with its AI analysis and routing.
- [ ] Can start/stop an incident and see the effect.

---

## Phase 12 — Testing ⬜

**Goal:** confidence across the tiers.

**Deliverables:** unit (domain, routing, idempotency, retries, breaker, AI validation), integration
(Mongo/Postgres/Redis/bus), contract (adapters, simulators, events), e2e (full WhatsApp flow), failure tests.

**Acceptance criteria**
- [ ] `pnpm test` green locally.
- [ ] e2e simulates a WhatsApp message end-to-end through analytics.
- [ ] Failure tests cover duplicate/timeout/invalid AI/DB failure/event retry.

---

## Phase 13 — CI/CD ⬜

**Goal:** automated quality gates.

**Deliverables:** GitHub Actions: install → lint → typecheck → unit → integration → build → docker build;
optional security scan + dependency audit.

**Acceptance criteria**
- [ ] Pipeline fails on lint/typecheck/critical test/build failure.
- [ ] Docker images build in CI.

---

## Phase 14 — Final Documentation ⬜

**Goal:** the portfolio-grade story.

**Deliverables:** finalized architecture docs, ADRs, runbooks, incident postmortems, scalability doc, and an
interview walkthrough.

**Acceptance criteria**
- [ ] Every incident has a runbook + postmortem.
- [ ] `docker compose up` + documented test command reproduce the full success checklist in the README.
- [ ] Interview walkthrough explains each decision, observable, test and incident.
