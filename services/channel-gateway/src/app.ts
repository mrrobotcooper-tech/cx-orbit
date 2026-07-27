import {
  type AppServer,
  createServer,
  type IdempotencyStore,
  type Logger,
  type Metrics,
} from '@cx-orbit/platform';
import type { Channel } from '@cx-orbit/shared';
import type { InboundAdapter } from './adapters/index.js';
import { createIngestService, type EventPublisher } from './ingest.js';
import { createGatewayMetrics } from './metrics.js';
import { registerWebhookRoutes } from './routes/webhooks.js';

export interface BuildAppDeps {
  logger: Logger;
  metrics: Metrics;
  publisher: EventPublisher;
  idempotency: IdempotencyStore;
  adapters: Record<Channel, InboundAdapter>;
  idempotencyTtlSeconds?: number | undefined;
  readiness?: (() => Promise<boolean> | boolean) | undefined;
}

/**
 * Assemble the gateway HTTP app from its dependencies. Everything infra-related
 * is injected, so tests can build the same app with fakes and drive it via
 * `app.inject(...)`.
 */
export async function buildApp(deps: BuildAppDeps): Promise<AppServer> {
  const gatewayMetrics = createGatewayMetrics(deps.metrics.registry);
  const ingest = createIngestService({
    publisher: deps.publisher,
    idempotency: deps.idempotency,
    metrics: gatewayMetrics,
    idempotencyTtlSeconds: deps.idempotencyTtlSeconds,
  });

  const app = await createServer({
    logger: deps.logger,
    metrics: deps.metrics,
    readiness: deps.readiness,
  });

  registerWebhookRoutes(app, {
    adapters: deps.adapters,
    ingest,
    metrics: gatewayMetrics,
  });

  return app;
}
