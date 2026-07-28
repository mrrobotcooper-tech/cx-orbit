# @cx-orbit/routing-service

The **Routing Service** turns AI analysis into an **explainable** assignment:
team + priority + `reason[]`, with optional human handoff when confidence is low.

## Responsibilities

- Consume `ai.analysis.completed`.
- Run a **pure, deterministic rule engine** (no black box).
- Persist the decision and emit `routing.completed` + `conversation.assigned` via
  the transactional Postgres outbox.
- Expose `POST /route` for synchronous demos and `GET /routing/decisions/:id`.

## Rule highlights

1. `confidence < ROUTING_MIN_CONFIDENCE` → `handoffToHuman=true`, `handoffReason=LOW_AI_CONFIDENCE`
2. Intent → team (`billing`, `retention`, `support`, `general`, …)
3. Negative sentiment raises priority; email lowers it slightly
4. Every step appends to `reason[]`

## Configuration

| Env | Default |
| --- | ------- |
| `ROUTING_SERVICE_PORT` | `8084` |
| `POSTGRES_URL` | `postgresql://cxorbit:cxorbit@localhost:5433/cxorbit` |
| `ROUTING_MIN_CONFIDENCE` | `0.7` |
| `NATS_URL` / `REDIS_URL` | localhost defaults |

## Local development

```bash
pnpm --filter @cx-orbit/routing-service dev

curl -sS -X POST http://localhost:8084/route \
  -H 'content-type: application/json' \
  -d '{"conversationId":"conv_1","intent":"billing","sentiment":"negative","confidence":0.91,"channel":"webchat"}'
```
