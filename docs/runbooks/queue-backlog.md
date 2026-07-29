# Runbook — Queue Backlog (INC-003)

1. **Symptom:** JetStream consumer lag rises; message handling slows.
2. **Dashboards:** Analytics lag panels; Prometheus `consumer_lag`.
3. **Logs:** Consumers processing continuously; incident-simulator flood warnings.
4. **Metrics:** consumer lag / pending; `eventsByType` surge on `message.received`.
5. **Mitigation:** Stop INC-003 (stops further floods). Scale consumers or wait for drain.
6. **Permanent fix:** Backpressure, durable consumers, lag alerts (ADR-001).
