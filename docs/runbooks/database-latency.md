# Runbook — Database Latency (INC-004)

1. **Symptom:** Conversation handlers slow; p95 rises; outbox pending may grow.
2. **Dashboards:** Conversation HTTP/handler duration; outbox pending gauge.
3. **Logs:** `db latency fault active (INC-004)`.
4. **Metrics:** handler duration; `conversation_outbox_pending`.
5. **Mitigation:** Stop INC-004 (clears Redis `db_latency_ms`).
6. **Permanent fix:** Query budgets, pool sizing, indexes (ADR-003).
