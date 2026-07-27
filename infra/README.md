# Infrastructure (Phase 1)

Local infrastructure for CX-ORBIT, orchestrated by the root [`docker-compose.yml`](../docker-compose.yml).
This is a **development** stack (single replicas, filesystem storage) — not production configuration.

## Components

| Component | Image | Host port | Purpose |
| --------- | ----- | --------- | ------- |
| MongoDB | `mongo:7` | 27017 | Conversations & messages (Phase 4) |
| PostgreSQL | `postgres:16-alpine` | 5432 | Customers, routing, config, incidents, outbox |
| Redis | `redis:7-alpine` | 6379 | Cache, idempotency, rate limit, locks, DLQ |
| NATS JetStream | `nats:2.10-alpine` | 4222 / 8222 | Event bus (client / monitoring) — see [ADR-001](../docs/adr/ADR-001-event-driven-architecture.md) |
| Prometheus | `prom/prometheus:v2.55.1` | 9090 | Metrics scraping |
| Loki | `grafana/loki:3.2.1` | 3100 | Log aggregation |
| Promtail | `grafana/promtail:3.2.1` | — | Ships container logs to Loki |
| Grafana | `grafana/grafana:11.3.1` | 3001 | Dashboards (Prometheus + Loki) |
| OTel Collector | `otel/opentelemetry-collector-contrib` | 4317 / 4318 | Optional tracing (`--profile tracing`) |

## Layout

```text
infra/
├── prometheus/prometheus.yml            # scrape config (self + future services)
├── grafana/
│   ├── provisioning/datasources/*.yml   # Prometheus + Loki datasources
│   ├── provisioning/dashboards/*.yml    # dashboard provider
│   └── dashboards/*.json                # provisioned dashboards
├── loki/
│   ├── loki-config.yml                  # single-binary Loki
│   └── promtail-config.yml              # Docker log discovery → Loki
├── otel/otel-collector-config.yml       # optional OTLP pipeline
└── postgres/init/01-init.sql            # extensions + logical schemas (first boot only)
```

## Usage

```bash
cp .env.example .env          # optional; defaults work without it
docker compose up -d          # start the whole stack
docker compose ps             # watch health status
bash scripts/verify-infra.sh  # automated checks (run after services are healthy)
docker compose down           # stop (add -v to also delete data volumes)

# Optional tracing stack:
docker compose --profile tracing up -d
```

## Access

- **Grafana:** http://localhost:3001 (anonymous viewer enabled; admin `admin`/`admin` by default).
  The **CX-ORBIT — Infrastructure Health** dashboard is auto-provisioned.
- **Prometheus:** http://localhost:9090
- **Loki:** queried through Grafana (Explore → Loki).
- **NATS monitoring:** http://localhost:8222 (`/healthz`, `/jsz`, `/varz`).

## Notes

- Application services (ports 8080–8087) appear as **down** in Prometheus until their phase is implemented —
  this is expected.
- All data persists in named Docker volumes; `docker compose down -v` wipes them for a clean slate.
- No secrets are committed; credentials come from `.env` with development defaults.
