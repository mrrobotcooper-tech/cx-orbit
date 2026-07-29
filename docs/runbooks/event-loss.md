# Runbook — Event Loss (INC-006)

1. **Symptom:** Downstream services stop seeing new conversation events; outbox pending grows.
2. **Dashboards:** Outbox pending; missing `conversation.*` in analytics.
3. **Logs:** `outbox drop fault active; skipping publish (INC-006)`.
4. **Metrics:** `conversation_outbox_pending` rising while publishes stall.
5. **Mitigation:** Stop INC-006 (clears `outbox_drop`); relay drains pending.
6. **Permanent fix:** Transactional outbox + relay + reconciliation (ADR-005).
