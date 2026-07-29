# Runbook — Duplicate Messages (INC-001)

1. **Symptom:** Same inbound message appears twice on the bus / provider retries.
2. **Dashboards:** Grafana business (inbound messages), conversation metrics.
3. **Logs:** `conversation-service` lines with `result=duplicate`.
4. **Metrics:** `conversation_messages_processed_total{result="duplicate"}`.
5. **Mitigation:** Stop INC-001 (`POST /incidents/:id/stop`). Traffic can continue; dedupe holds.
6. **Permanent fix:** Unique index `(channel, externalMessageId)` + Redis NX at gateway (ADR-004).
