# Runbook — AI Invalid Response (INC-005)

1. **Symptom:** AI validation failures; fallback analyses; more handoffs.
2. **Dashboards:** AI containment / low confidence; routing handoff rate.
3. **Logs:** `AIValidationError` / fallback path in `ai-service`.
4. **Metrics:** AI analyses with fallback; handoff counter.
5. **Mitigation:** Stop INC-005 (clears Redis `ai_force_failure`).
6. **Permanent fix:** Zod validation + deterministic fallback (ADR-008).
