# Runbook — Provider Timeout (INC-002)

1. **Symptom:** Outbound deliveries fail with TIMEOUT; latency spikes; breaker may open.
2. **Dashboards:** Outbound / delivery success rate; Prometheus circuit breaker gauges.
3. **Logs:** `outbound-service` TIMEOUT / retry / `CIRCUIT_OPEN`.
4. **Metrics:** delivery failures by reason; DLQ size.
5. **Mitigation:** Stop INC-002 (clears Redis `webchat_simulate`). Wait for breaker reset.
6. **Permanent fix:** Retry + exponential backoff + circuit breaker + DLQ (Phase 8 kit).
