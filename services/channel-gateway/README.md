# @cx-orbit/channel-gateway

The **Channel Gateway** is the single ingress for all inbound messages. It turns
provider-specific webhooks (WhatsApp, Telegram, Email, Instagram, Facebook, X and
our own WebChat) into **canonical `message.received` events** on NATS JetStream.
No provider payload shape leaks beyond this service (ADR-002).

## Responsibilities

- Expose one webhook endpoint per provider: `POST /webhooks/:channel`.
- Authenticate the call (simulated token auth; real providers use HMAC signatures).
- Normalize the provider payload into a `CanonicalInboundMessage` (`@cx-orbit/shared`).
- Deduplicate provider retries with a Redis `SET NX` idempotency key
  (`inbound:<channel>:<externalMessageId>`) — the fast first line of defense; the
  authoritative dedupe is the DB unique index downstream (ADR-004).
- Publish `message.received` and acknowledge fast.

It owns **no database**. It is a thin, stateless adapter layer.

## Endpoints

| Method | Path                 | Purpose                                   |
| ------ | -------------------- | ----------------------------------------- |
| POST   | `/webhooks/:channel` | Provider webhook ingress                  |
| GET    | `/health`            | Liveness                                  |
| GET    | `/ready`             | Readiness (checks Redis + NATS)           |
| GET    | `/metrics`           | Prometheus metrics                        |

Responses: `202 accepted`, `200 duplicate`, `400 invalid_payload`,
`401 unauthorized`, `404 unknown_channel`.

## Metrics

- `gateway_inbound_messages_total{channel}`
- `gateway_inbound_duplicates_total{channel}`
- `gateway_inbound_errors_total{channel,reason}`
- plus the standard HTTP RED metrics from `@cx-orbit/platform`.

## Configuration

| Env                       | Default                  | Notes                                    |
| ------------------------- | ------------------------ | ---------------------------------------- |
| `HOST`                    | `0.0.0.0`                |                                          |
| `CHANNEL_GATEWAY_PORT`    | `8080`                   |                                          |
| `NATS_URL`                | `nats://localhost:4222`  | Use localhost when running on the host   |
| `NATS_STREAM`             | `CXORBIT`                |                                          |
| `REDIS_URL`               | `redis://localhost:6379` |                                          |
| `WEBHOOK_SECRET`          | _(unset)_                | When set, require `x-webhook-token`      |
| `IDEMPOTENCY_TTL_SECONDS` | `86400`                  | Idempotency key TTL                      |

## Local development

Infra must be up (`pnpm infra:up`). Then, from the repo root:

```bash
pnpm --filter @cx-orbit/channel-gateway dev
```

Send a test message:

```bash
curl -sS -X POST http://localhost:8080/webhooks/webchat \
  -H 'content-type: application/json' \
  -d '{"sessionId":"sess_1","messageId":"wc_1","from":{"id":"visitor_1","name":"Ana"},"text":"hola"}'
```

Inspect the event on the stream (requires the NATS CLI, optional):

```bash
nats --server localhost:4222 stream view CXORBIT
```

## Adapters

Each adapter implements `InboundAdapter` (`parseInboundEvent` + `validateWebhook`).
The registry in `src/adapters/index.ts` maps every `Channel` to an adapter; adding
a channel without an adapter is a compile error.
