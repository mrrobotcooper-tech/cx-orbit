# @cx-orbit/platform

Service **runtime kit** shared by every CX-ORBIT service. It provides the cross-cutting building blocks so
services focus on their domain, not boilerplate. Contains no business logic (ADR-009 / ADR-010).

## What's inside

```text
src/
├── config.ts             # loadEnv(schema) — validate process.env, fail fast; baseEnvSchema
├── logger.ts             # createLogger() — Pino JSON logs with secret redaction (ADR-007)
├── metrics.ts            # createMetrics() — Prometheus registry + RED HTTP metrics
├── http/
│   ├── server.ts         # createServer() — Fastify + /health /ready /metrics + correlationId/traceId
│   └── fastify-augment.ts# request.correlationId / request.traceId typing
├── messaging/
│   └── nats.ts           # connectEventBus() — JetStream publish with eventId msgID dedup
└── cache/
    ├── redis.ts          # createRedis()
    └── idempotency.ts    # createIdempotencyStore() — race-safe SET NX (ADR-004)
```

## Usage sketch

```ts
import {
  loadEnv,
  baseEnvSchema,
  createLogger,
  createMetrics,
  createServer,
  connectEventBus,
  createRedis,
  createIdempotencyStore,
} from '@cx-orbit/platform';

const env = loadEnv(baseEnvSchema);
const logger = createLogger({ service: 'my-service', level: env.LOG_LEVEL });
const metrics = createMetrics('my-service');
const app = await createServer({ logger, metrics, readiness: async () => true });
```

## Notes

- `createServer` echoes `x-correlation-id` / `x-trace-id` headers (or generates them) so a request is
  traceable end-to-end (ADR-007). Read them with `getRequestContext(req)`.
- `connectEventBus().publish(event)` sets `msgID = eventId`, giving JetStream broker-level de-duplication that
  complements consumer-side idempotency (ADR-001 / ADR-004).
- `createIdempotencyStore().markIfFirst(key)` is the fast first-line dedup; the DB unique index remains the
  authoritative guard.

## Scripts

```bash
pnpm --filter @cx-orbit/platform build
pnpm --filter @cx-orbit/platform typecheck
pnpm --filter @cx-orbit/platform test
```
