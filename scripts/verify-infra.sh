#!/usr/bin/env bash
# =====================================================================
# CX-ORBIT — Phase 1 infrastructure verification
#
# Checks that every infra component is up and answering. Run AFTER:
#   docker compose up -d
#
# Usage:  bash scripts/verify-infra.sh
# Each check retries for a while so it tolerates slow-starting services
# (Loki/Grafana take ~30s on first boot).
# Exits non-zero if any check ultimately fails.
# =====================================================================
set -uo pipefail

# Load .env if present (for custom ports), else use defaults.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-cxorbit}"
POSTGRES_DB="${POSTGRES_DB:-cxorbit}"
NATS_MONITOR_PORT="${NATS_MONITOR_PORT:-8222}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9090}"
GRAFANA_PORT="${GRAFANA_PORT:-3001}"
LOKI_PORT="${LOKI_PORT:-3100}"

RETRIES="${RETRIES:-15}"
SLEEP="${SLEEP:-2}"

pass=0
fail=0

# Retry a check function until it succeeds or retries run out.
check() {
  local name="$1"
  shift
  printf '  %-28s' "$name"
  local i=0
  while [ "$i" -lt "$RETRIES" ]; do
    if "$@" >/dev/null 2>&1; then
      echo "OK"
      pass=$((pass + 1))
      return 0
    fi
    i=$((i + 1))
    sleep "$SLEEP"
  done
  echo "FAIL"
  fail=$((fail + 1))
  return 1
}

# ---- Individual checks (run in the current shell, not `bash -c`) ------
mongo_ping() {
  docker exec cxorbit-mongo mongosh --quiet --eval "db.adminCommand('ping').ok" | grep -q 1
}
pg_ready() {
  docker exec cxorbit-postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
}
pg_schemas() {
  docker exec cxorbit-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "select count(*) from information_schema.schemata where schema_name in ('customer','routing','config','incident','outbox')" \
    | grep -q '^5$'
}
redis_ping() {
  docker exec cxorbit-redis redis-cli ping | grep -q PONG
}
nats_health() {
  curl -fsS --max-time 5 "http://localhost:${NATS_MONITOR_PORT}/healthz" | grep -qi '"status":"ok"\|ok'
}
nats_jetstream() {
  curl -fsS --max-time 5 "http://localhost:${NATS_MONITOR_PORT}/jsz" | grep -q '"config"'
}
prometheus_healthy() {
  curl -fsS --max-time 5 "http://localhost:${PROMETHEUS_PORT}/-/healthy" | grep -qi healthy
}
prometheus_self_up() {
  curl -fsS -G --max-time 5 "http://localhost:${PROMETHEUS_PORT}/api/v1/query" \
    --data-urlencode 'query=up{job="prometheus"}' | grep -q '"value"'
}
loki_ready() {
  curl -fsS --max-time 5 "http://localhost:${LOKI_PORT}/ready" | grep -q ready
}
grafana_health() {
  curl -fsS --max-time 5 "http://localhost:${GRAFANA_PORT}/api/health" | grep -q '"database": *"ok"'
}

echo "CX-ORBIT infrastructure checks"
echo "------------------------------"

check "MongoDB ping" mongo_ping
check "PostgreSQL ready" pg_ready
check "PostgreSQL schemas" pg_schemas
check "Redis PING" redis_ping
check "NATS healthz" nats_health
check "NATS JetStream" nats_jetstream
check "Prometheus healthy" prometheus_healthy
check "Prometheus self-up" prometheus_self_up
check "Loki ready" loki_ready
check "Grafana health" grafana_health

echo "------------------------------"
echo "Passed: ${pass}  Failed: ${fail}"

if [ "$fail" -ne 0 ]; then
  echo "Some checks failed. Inspect with: docker compose ps  &&  docker compose logs <service>"
  exit 1
fi
echo "All infrastructure checks passed."
