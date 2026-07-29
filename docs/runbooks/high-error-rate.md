# Runbook — High Error Rate (cross-cutting)

1. **Symptom:** Elevated 5xx / delivery failures / AI fallback across services.
2. **Dashboards:** Grafana technical + business; Prometheus error rates by service.
3. **Logs:** Filter by `correlationId` / `traceId` on the failing path.
4. **Metrics:** `http_requests_total{status=~"5.."}`, outbound failures, AI fallback, breaker open.
5. **Mitigation:** Identify active incidents (`GET :8087/incidents`) and stop them; check provider simulators; scale consumers if lag-driven.
6. **Permanent fix:** Depends on root cause — see INC-001…006 postmortems and ADRs 004–008.
