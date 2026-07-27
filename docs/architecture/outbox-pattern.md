# Deep Dive: The Outbox Pattern in CX-ORBIT

> Companion to [ADR-005](../adr/ADR-005-outbox-pattern.md). Explains the mechanics, the failure it prevents,
> and how **INC-006 (Event Loss)** exercises it. Implementation lands in Phase 4/10.

## The problem

Two side effects that must be consistent:

```text
   ┌───────────────┐      ┌────────────────┐
   │  DB commit    │ ───► │ publish event  │
   │ (business row)│      │  to NATS       │
   └───────────────┘      └────────────────┘
            ▲                      ▲
            └────── CRASH HERE ────┘   → business changed, nobody notified = LOST EVENT
```

Reordering does not help: publishing before commit risks announcing data that later rolls back.

## The solution

Write the business row **and** an outbox row in **one transaction**; publish asynchronously afterwards.

```text
 ┌──────────────────────── DB transaction ────────────────────────┐
 │  INSERT/UPDATE business data                                    │
 │  INSERT outbox(event_id, type, payload, status='PENDING', ...)  │
 └───────────────────────────── COMMIT ───────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │      Outbox Publisher      │  (polls PENDING rows)
                    └──────────────────────────┘
                                   │ publish to NATS (at-least-once)
                                   ▼
                    UPDATE outbox SET status='PUBLISHED'
```

If the publisher crashes, `PENDING` rows survive and are retried on restart → **no lost events**.
At-least-once publishing means duplicates are possible → consumers are idempotent (ADR-004).

## Outbox table (Postgres) — proposed shape

| column | type | notes |
| ------ | ---- | ----- |
| `id` | uuid / bigserial | PK |
| `event_id` | text unique | matches envelope `eventId` (dedupe) |
| `event_type` | text | e.g. `conversation.created` |
| `payload` | jsonb | full event envelope |
| `status` | text | `PENDING` \| `PUBLISHED` |
| `created_at` | timestamptz | |
| `published_at` | timestamptz null | set on success |
| `attempts` | int | publish attempts (bounded) |

## Recovery & reconciliation

- **Recovery:** on startup the publisher scans `PENDING` rows older than a threshold and republishes.
- **Reconciliation:** a periodic check compares business rows against published outbox rows to detect gaps
  (the diagnostic used in INC-006).

## How INC-006 uses this

1. Inject a crash/kill **between commit and publish** (before the publisher runs).
2. Observe: business data exists, but the downstream consumer never received the event (analytics gap,
   conversation stuck).
3. Diagnose via the reconciliation check + outbox `PENDING` count metric.
4. Fix: restart the publisher / run recovery → event flows, state converges.
5. Regression test asserts that after a simulated crash, recovery republishes exactly the pending events and
   consumers converge (idempotently).

## Scaling notes

- Polling is fine locally; production would prefer **CDC (e.g. Debezium)** tailing the WAL — noted as a future
  option in [scalability](../scalability/README.md), intentionally out of scope for the local lab.
