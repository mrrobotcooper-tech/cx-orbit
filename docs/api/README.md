# API Reference

> **Status:** Phase 0 (placeholder). Per-service API references are written as each service is implemented
> (Phases 3–10). Each service also exposes an OpenAPI/JSON schema derived from its Zod contracts where practical.

## Conventions (all services)

- **Base path:** service-specific (see [port map](../../README.md#-service--port-map)).
- **Health/observability endpoints (every service):**
  - `GET /health` — liveness
  - `GET /ready` — readiness (dependencies reachable)
  - `GET /metrics` — Prometheus exposition format
- **Correlation:** requests accept/propagate `x-correlation-id` and `x-trace-id` headers; responses echo them.
- **Errors:** JSON problem shape `{ "error": { "code", "message", "details?" } }`.
- **Validation:** request/response bodies validated with Zod; 400 on invalid input.
- **Pagination:** list endpoints use `?limit=&cursor=` (or `?page=&pageSize=`) — finalized per service.

## Planned per-service references

| Service | Doc | Phase |
| ------- | --- | ----- |
| Channel Gateway | `channel-gateway.md` | 3 |
| Conversation Service | `conversation-service.md` | 4 |
| Customer Service | `customer-service.md` | 5 |
| AI Service | `ai-service.md` | 6 |
| Routing Service | `routing-service.md` | 7 |
| Outbound Service | `outbound-service.md` | 8 |
| Analytics Service | `analytics-service.md` | 9 |
| Incident Simulator | `incident-simulator.md` | 10 |
| Provider Simulators | `provider-simulators.md` | 3 & 8 |
