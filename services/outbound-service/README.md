# @cx-orbit/outbound-service

Reliable **egress** for canonical outbound messages (ADR-006):

- Consume `message.send.requested`
- Call channel adapters (WebChat → local simulator; other channels stubbed)
- **Timeout** + **bounded retries** + **exponential backoff with full jitter**
- **Circuit breaker** per channel (`CLOSED` / `OPEN` / `HALF_OPEN`)
- **DLQ** in Redis when retries are exhausted
- Emit `message.sent` or `message.delivery.failed`

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/send` | Sync send (same path as the consumer) |
| GET | `/dlq` | Inspect dead-lettered messages |
| GET | `/circuits/:channel` | Breaker state |
| GET | `/health` `/ready` `/metrics` | Ops |

## Metrics

`provider_requests_total`, `provider_failures_total`, `provider_latency_seconds`,
`circuit_breaker_state`, `outbound_dlq_size`.

## Local development

```bash
# Terminal A — simulator
pnpm --filter @cx-orbit/webchat-provider dev

# Terminal B — outbound
pnpm --filter @cx-orbit/outbound-service dev

curl -sS -X POST http://localhost:8085/send \
  -H 'content-type: application/json' \
  -d '{"conversationId":"conv_1","channel":"webchat","recipientExternalId":"visitor_1","content":{"type":"text","text":"hola"},"idempotencyKey":"send_demo_1"}'
```

Force failures: `WEBCHAT_SIMULATE_FAULT=error` (or `timeout` / `rate_limit`).
