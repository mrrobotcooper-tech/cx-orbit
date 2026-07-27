import {
  type AppServer,
  type Logger,
  type Metrics,
  type PostgresConnection,
  createServer,
} from '@cx-orbit/platform';
import { registerCustomerRoutes } from './routes/customers.js';

export interface BuildAppDeps {
  logger: Logger;
  metrics: Metrics;
  pg: PostgresConnection;
  defaultPageSize: number;
  maxPageSize: number;
  readiness?: (() => Promise<boolean> | boolean) | undefined;
}

export async function buildApp(deps: BuildAppDeps): Promise<AppServer> {
  const app = await createServer({
    logger: deps.logger,
    metrics: deps.metrics,
    readiness: deps.readiness,
  });

  registerCustomerRoutes(app, {
    pg: deps.pg,
    defaultPageSize: deps.defaultPageSize,
    maxPageSize: deps.maxPageSize,
  });

  return app;
}
