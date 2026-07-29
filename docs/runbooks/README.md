# Runbooks

> **Status:** Phase 10 — core incident runbooks authored. Phase 14 may deepen interview walkthroughs.

A runbook is an operational playbook for responding to a symptom **fast**, before root-causing. Every runbook
answers the same six questions:

```text
1. What is the symptom?
2. What dashboards should I check?
3. What logs should I inspect?
4. What metrics matter?
5. What immediate mitigation can I apply?
6. What is the permanent fix?
```

## Available runbooks

| Runbook | Related incident |
| ------- | ---------------- |
| [Provider Timeout](provider-timeout.md) | INC-002 |
| [Queue Backlog](queue-backlog.md) | INC-003 |
| [Database Latency](database-latency.md) | INC-004 |
| [Duplicate Messages](duplicate-messages.md) | INC-001 |
| [AI Provider Failure](ai-provider-failure.md) | INC-005 |
| [Event Loss](event-loss.md) | INC-006 |
| [High Error Rate](high-error-rate.md) | cross-cutting |
