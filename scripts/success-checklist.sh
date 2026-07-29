#!/usr/bin/env bash
# Smoke checklist after infra + services are up. Exits non-zero on first failure.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Health probes"
for port in 8080 8081 8082 8083 8084 8085 8086 8087; do
  curl -sf "http://localhost:${port}/health" >/dev/null
  echo "  :${port} ok"
done

echo "==> Analytics summary"
curl -sf "http://localhost:8086/summary" | head -c 200
echo

echo "==> Incident catalog"
curl -sf "http://localhost:8087/incidents" | head -c 200
echo

echo "==> Unit tests"
pnpm test:unit

echo "==> All success-checklist probes passed"
