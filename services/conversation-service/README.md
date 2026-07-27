# @cx-orbit/conversation-service

The **Conversation Service** is the **system of record** for conversations and
messages. It consumes canonical events, persists state in MongoDB, and publishes
its own domain events reliably via the **transactional Outbox pattern** (ADR-005).

## Responsibilities

- Consume `message.received` → create/reopen a conversation and persist the message.
- Consume `routing.completed` → apply the routing decision (team, priority, handoff).
- Expose a read/query REST API over conversations and messages.
- Emit `conversation.created`, `conversation.updated`, `conversation.assigned`,
  `conversation.resolved` — written to the outbox in the same DB transaction as the
  state change, then relayed to NATS.

## Data model (MongoDB)

- `conversations` — the aggregate (status, counts, assignment, timestamps).
- `messages` — one document per message. Unique index on
  `(channel, externalMessageId)` is the **authoritative dedupe guard** (ADR-004).
- `conversation_outbox` — pending/published domain events.
- `conversation_dead_letters` — terminally-failed inbound events.

Mongo runs as a **single-node replica set** so multi-document transactions are
available (see `docker-compose.yml`).

## Reliability

- **Transactional outbox:** the domain write and the event enqueue commit
  atomically; a background relay publishes pending entries and marks them
  published. Publishing uses `msgID = eventId`, so JetStream collapses any
  duplicate from a crash-and-retry — effectively-once end to end.
- **Idempotent consumer:** redelivered events are safe (unique index + pre-check).
- **Dead-letter:** poison/failed events (after `maxDeliver`) are stored for inspection.

## REST API

| Method | Path                            | Purpose                                   |
| ------ | ------------------------------- | ----------------------------------------- |
| GET    | `/conversations`                | List (filters + pagination)               |
| GET    | `/conversations/:id`            | Conversation + messages                   |
| POST   | `/conversations/:id/resolve`    | Resolve (`{ "resolvedBy": "bot"\|"agent" }`) |
| GET    | `/health` `/ready` `/metrics`   | Ops endpoints                             |

**List filters:** `channel`, `status`, `priority`, `assignedTeam`, `createdFrom`,
`createdTo`, `page`, `pageSize`.

## Configuration

| Env                        | Default                                                  |
| -------------------------- | ------------------------------------------------------- |
| `CONVERSATION_SERVICE_PORT`| `8081`                                                  |
| `MONGO_URI`                | `mongodb://localhost:27017/cxorbit?directConnection=true` |
| `MONGO_DB`                 | `cxorbit`                                                |
| `NATS_URL`                 | `nats://localhost:4222`                                  |
| `CONSUMER_DURABLE`         | `conversation-service`                                   |
| `OUTBOX_POLL_INTERVAL_MS`  | `500`                                                    |

## Local development

Infra up (`pnpm infra:up`), then from the repo root:

```bash
pnpm --filter @cx-orbit/conversation-service dev
```

Drive it end to end via the Channel Gateway (send a webhook), or query directly:

```bash
curl -s 'http://localhost:8081/conversations?channel=webchat&pageSize=5' | jq
```
