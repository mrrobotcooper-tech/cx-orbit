#!/usr/bin/env bash
# Build every CX-ORBIT application image from the repo root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

images=(
  "services/channel-gateway/Dockerfile|cxorbit/channel-gateway"
  "services/conversation-service/Dockerfile|cxorbit/conversation-service"
  "services/customer-service/Dockerfile|cxorbit/customer-service"
  "services/ai-service/Dockerfile|cxorbit/ai-service"
  "services/routing-service/Dockerfile|cxorbit/routing-service"
  "services/outbound-service/Dockerfile|cxorbit/outbound-service"
  "services/analytics-service/Dockerfile|cxorbit/analytics-service"
  "services/incident-simulator/Dockerfile|cxorbit/incident-simulator"
  "simulators/webchat-provider/Dockerfile|cxorbit/webchat-provider"
  "frontend/Dockerfile|cxorbit/frontend"
)

for entry in "${images[@]}"; do
  file="${entry%%|*}"
  tag="${entry##*|}"
  echo "==> Building ${tag} (${file})"
  docker build -f "$file" -t "${tag}:local" .
done

echo "==> All images built"
