# Incident Simulator

Controlled failure injection for CX-ORBIT (Phase 10). Starts/stops INC-001…006,
emits `incident.started` / `incident.ended`, and either publishes symptomatic
events or sets Redis fault flags consumed by other services.

## API

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/incidents` | Catalog + active incidents |
| `GET` | `/incidents/:id` | Active incident details |
| `POST` | `/incidents/start` | Start by `type` or `code` |
| `POST` | `/incidents/:id/stop` | Stop one incident |
| `POST` | `/incidents/stop-all` | Stop everything |

### Start body

```json
{
  "type": "PROVIDER_TIMEOUT",
  "code": "INC-002",
  "durationSeconds": 60,
  "params": {}
}
```

Provide **either** `type` or `code` (both accepted). Optional `durationSeconds`
auto-stops with reason `completed`.

## Incidents

| Code | Type | Effect |
| ---- | ---- | ------ |
| INC-001 | `DUPLICATE_MESSAGES` | Publishes 2× `message.received` with the same `externalMessageId` |
| INC-002 | `PROVIDER_TIMEOUT` | Redis `webchat_simulate=timeout` → outbound retries/breaker |
| INC-003 | `QUEUE_BACKLOG` | Floods `message.received` (default 50, override `params.count`) |
| INC-004 | `DATABASE_LATENCY` | Redis `db_latency_ms` → conversation sleeps before Mongo |
| INC-005 | `AI_INVALID_RESPONSE` | Redis `ai_force_failure=INVALID_JSON` → AI validation fallback |
| INC-006 | `EVENT_LOSS` | Redis `outbox_drop=1` → outbox relay skips publish |

## Run

```bash
pnpm --filter @cx-orbit/incident-simulator dev
# port 8087
```

## Quick curls

```bash
curl -s http://localhost:8087/incidents | jq .
curl -s -X POST http://localhost:8087/incidents/start \
  -H 'content-type: application/json' \
  -d '{"code":"INC-002","durationSeconds":30}' | jq .
curl -s -X POST http://localhost:8087/incidents/stop-all | jq .
```
