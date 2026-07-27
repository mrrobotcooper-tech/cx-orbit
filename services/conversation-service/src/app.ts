import { type AppServer, type Logger, type Metrics, createServer } from '@cx-orbit/platform';
import type { Collections } from './db/collections.js';
import { registerConversationRoutes } from './routes/conversations.js';
import type { ConversationService } from './service/conversation-service.js';

export interface BuildAppDeps {
  logger: Logger;
  metrics: Metrics;
  collections: Collections;
  service: ConversationService;
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

  registerConversationRoutes(app, {
    collections: deps.collections,
    service: deps.service,
    defaultPageSize: deps.defaultPageSize,
    maxPageSize: deps.maxPageSize,
  });

  return app;
}
