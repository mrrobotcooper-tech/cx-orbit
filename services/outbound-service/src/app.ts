import { type AppServer, type Logger, type Metrics, createServer } from '@cx-orbit/platform';
import type { DeadLetterQueue } from './dlq.js';
import { registerOutboundRoutes } from './routes/send.js';
import type { DeliveryService } from './service/delivery-service.js';

export interface BuildAppDeps {
  logger: Logger;
  metrics: Metrics;
  service: DeliveryService;
  dlq: DeadLetterQueue;
  readiness?: (() => Promise<boolean> | boolean) | undefined;
}

export async function buildApp(deps: BuildAppDeps): Promise<AppServer> {
  const app = await createServer({
    logger: deps.logger,
    metrics: deps.metrics,
    readiness: deps.readiness,
  });
  registerOutboundRoutes(app, { service: deps.service, dlq: deps.dlq });
  return app;
}
