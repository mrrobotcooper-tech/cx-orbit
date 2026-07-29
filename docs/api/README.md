# API Reference

> **Status:** Phase 14 — consolidated operator/service API map. Conventions apply to every Fastify service.

## Conventions

- **Health:** `GET /health`, `GET /ready`, `GET /metrics` on every service.
- **Correlation:** `x-correlation-id` / `x-trace-id` accepted and echoed.
- **Validation:** Zod at boundaries; invalid input → 400.
- **Dev proxy:** frontend Vite proxies `/svc/<name>/*` → `localhost:808x`.

## Port map

| Service | Port | Base (dev) |
| ------- | ---- | ---------- |
| Channel Gateway | 8080 | `/` |
| Conversation | 8081 | `/` |
| Customer | 8082 | `/` |
| AI | 8083 | `/` |
| Routing | 8084 | `/` |
| Outbound | 8085 | `/` |
| Analytics | 8086 | `/` |
| Incident Simulator | 8087 | `/` |
| WebChat provider sim | 9107 | `/` |

---

## Channel Gateway `:8080`

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/webhooks/:channel` | Ingest provider payload → `message.received`. 202 accepted, 200 duplicate, 400 invalid, 401 if secret set, 404 unknown channel. |

Channels: `webchat`, `whatsapp`, `telegram`, `email`, `instagram`, `facebook`, `x`.

Optional header: `x-webhook-token` when `WEBHOOK_SECRET` is configured.

## Conversation `:8081`

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/conversations` | Filters: `channel`, `status`, `priority`, `assignedTeam`, `page`, `pageSize`. |
| GET | `/conversations/:id` | `{ conversation, messages }` — timeline by `createdAt`. |
| POST | `/conversations/:id/resolve` | Body `{ resolvedBy?: "bot"\|"agent" }`. |

## Customer `:8082`

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/customers` | `channel`, `page`, `pageSize`. |
| GET | `/customers/resolve` | `channel` + `externalId`. |
| GET | `/customers/:id` | Profile + identities. |

## AI `:8083`

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/analyze` | `{ text, conversationId, messageId? }` → analysis (+ fallback). |

## Routing `:8084`

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/route` | Sync decision demo. |
| GET | `/routing/decisions/:conversationId` | Last decisions with reasons / handoff. |

## Outbound `:8085`

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/send` | Manual send demo. |
| GET | `/dlq` | Dead-letter entries. |
| GET | `/circuits/:channel` | Breaker state. |

## Analytics `:8086`

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/summary` | `{ business, technical }` rollup (in-memory). |

## Incident Simulator `:8087`

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/incidents` | Catalog + active. |
| GET | `/incidents/:id` | Active detail. |
| POST | `/incidents/start` | `{ code\|type, durationSeconds?, params? }`. |
| POST | `/incidents/:id/stop` | Stop one. |
| POST | `/incidents/stop-all` | Stop all. |

## WebChat provider `:9107`

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/v1/messages` | Outbound target. Header `x-simulate-fault`: `timeout` \| `error` \| `rate_limit`. |
| GET | `/messages` | Recent deliveries. |
