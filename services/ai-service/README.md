# @cx-orbit/ai-service

The **AI Service** enriches conversations with intent, sentiment, entities and a
short summary. It is **provider-agnostic** (ADR-008): by default it runs fully
offline with `MockAIProvider` (`AI_PROVIDER=mock`, no API keys).

## Responsibilities

- Consume `conversation.updated` (inbound messages with `changes.text`).
- Call the configured `AIProvider`, **validate every result with Zod**.
- On invalid/timeout/provider error → **fallback** analysis (`intent=unknown`,
  `confidence=0`) and still emit `ai.analysis.completed` so routing can hand off.
- Deduplicate via Redis (`ai:{conversationId}:{messageId}`).
- Expose `POST /analyze` for synchronous demos.

## Failure modes (injectable)

Set `AI_FORCE_FAILURE` to one of:

`NONE` | `LOW_CONFIDENCE` | `INVALID_JSON` | `TIMEOUT` | `RATE_LIMIT` | `HALLUCINATION` | `PROVIDER_ERROR`

Invalid output never crashes the flow (ADR-008 / INC-005).

## REST

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/analyze` | Sync analysis + publish |
| GET | `/health` `/ready` `/metrics` | Ops |

## Configuration

| Env | Default |
| --- | ------- |
| `AI_SERVICE_PORT` | `8083` |
| `AI_PROVIDER` | `mock` |
| `AI_MIN_CONFIDENCE` | `0.7` |
| `AI_TIMEOUT_MS` | `5000` |
| `AI_FORCE_FAILURE` | `NONE` |
| `NATS_URL` | `nats://localhost:4222` |
| `REDIS_URL` | `redis://localhost:6379` |

## Local development

```bash
pnpm --filter @cx-orbit/ai-service dev

curl -sS -X POST http://localhost:8083/analyze \
  -H 'content-type: application/json' \
  -d '{"text":"Hola, tengo un problema con mi factura ORD-123","conversationId":"conv_demo","messageId":"msg_1"}'
```
