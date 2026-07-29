# Testing

CX-ORBIT uses **Vitest** across unit, integration, contract and e2e tiers.

## Commands

| Command | What runs |
| ------- | --------- |
| `pnpm test` | All packages that define `test` (unit + skipped IT/e2e) |
| `pnpm test:unit` | Same unit suites (`test:unit` where present) |
| `pnpm test:integration` | Live Mongo / Postgres / Redis / NATS suites (`RUN_INTEGRATION=1`) |
| `pnpm test:e2e` | Live full-stack WhatsApp → analytics (`RUN_E2E=1`) |

Root scripts use `pnpm -r --if-present` so packages without a tier script are skipped.

## Unit (always on)

Covers domain helpers, routing engine, idempotency (fake Redis), retries / circuit breaker,
AI validation + fallback, outbound delivery / DLQ, gateway adapters, analytics aggregator,
incident engine, webchat/whatsapp contracts.

## Integration (opt-in)

Requires `pnpm infra:up` (or equivalent Compose stack).

```bash
RUN_INTEGRATION=1 pnpm test:integration
# or per package:
RUN_INTEGRATION=1 pnpm --filter @cx-orbit/conversation-service test:integration
RUN_INTEGRATION=1 pnpm --filter @cx-orbit/customer-service test:integration
RUN_INTEGRATION=1 pnpm --filter @cx-orbit/platform test:integration
```

| Package | Infra |
| ------- | ----- |
| conversation-service | Mongo replica set + NATS |
| customer-service | Postgres (`POSTGRES_URL`, host port often **5433**) + NATS |
| platform | Redis |

Without `RUN_INTEGRATION=1`, integration `describe` blocks are **skipped** and `pnpm test` stays green.

## Contract

- Gateway adapters → `CanonicalInboundMessage` (`services/channel-gateway/test/adapters.test.ts`)
- Shared event registry (`packages/shared/test/registry.test.ts`)
- WebChat simulator accept / fault headers (`simulators/webchat-provider/test/contract.test.ts`)
- WhatsApp fixtures (`simulators/whatsapp-provider/test/contract.test.ts`)

## E2E (opt-in)

Stack must be running (infra + gateway + conversation + analytics at minimum; full pipeline for AI/routing assertions).

```bash
RUN_E2E=1 pnpm --filter @cx-orbit/e2e test:e2e
# or
RUN_E2E=1 pnpm test:e2e
```

- `tests/e2e/whatsapp-pipeline.test.ts` — WhatsApp webhook → analytics inbound (+ conversation list)
- `tests/e2e/failures.test.ts` — gateway duplicate + incident start/stop

## Failure coverage map

| Mode | Where |
| ---- | ----- |
| Duplicate messages | gateway webhooks unit; conversation IT; e2e failures |
| Provider timeout | outbound delivery unit; incident INC-002; webchat contract faults |
| Invalid AI | ai-service providers + analysis unit |
| DB latency | conversation IT (`DATABASE_LATENCY` fault) |
| Event loss / retry | outbox relay unit (`OUTBOX_DROP`, publish retry); conversation IT |
