# @cx-orbit/analytics-service

Read-only **event-stream analytics**: consumes the canonical NATS JetStream
namespace and exposes **business + technical** Prometheus metrics plus a JSON
summary for demos.

## What it measures

| Metric | Kind |
| ------ | ---- |
| `analytics_messages_total{channel,direction}` | Business |
| `analytics_conversations_created_total` | Business |
| `analytics_customers_created_total` | Business |
| `analytics_ai_analyses_total{intent,sentiment}` | Business |
| `analytics_routing_decisions_total{team,handoff}` | Business |
| `analytics_delivery_results_total` | Business |
| `analytics_resolution_time_seconds` | Business |
| `analytics_events_consumed_total{type}` | Technical |
| `analytics_consumer_lag` / `ack_pending` | Technical |
| `analytics_ai_low_confidence_total` | Technical |
| `analytics_delivery_failures_total` | Technical |

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/summary` | JSON rollup (handoff rate, AI containment, …) |
| GET | `/metrics` | Prometheus |
| GET | `/health` `/ready` | Ops |

## Local development

```bash
pnpm --filter @cx-orbit/analytics-service dev

curl -s http://localhost:8086/summary | jq
curl -s http://localhost:8086/metrics | grep analytics_
```

Grafana dashboard: **CX-ORBIT Business Analytics** (provisioned under
`infra/grafana/dashboards/`).
