import {
  type AppServer,
  type Logger,
  type Metrics,
  type PostgresConnection,
  createServer,
} from '@cx-orbit/platform';
import { registerRouteRoutes } from './routes/route.js';
import type { RoutingService } from './service/routing-service.js';

export interface BuildAppDeps {
  logger: Logger;
  metrics: Metrics;
  pg: PostgresConnection;
  service: RoutingService;
  readiness?: (() => Promise<boolean> | boolean) | undefined;
}

export async function buildApp(deps: BuildAppDeps): Promise<AppServer> {
  const app = await createServer({
    logger: deps.logger,
    metrics: deps.metrics,
    readiness: deps.readiness,
  });
  registerRouteRoutes(app, { service: deps.service, pg: deps.pg });
  return app;
}
