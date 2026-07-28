import { type AppServer, type Logger, type Metrics, createServer } from '@cx-orbit/platform';
import { registerAnalyzeRoutes } from './routes/analyze.js';
import type { AnalysisService } from './service/analysis-service.js';

export interface BuildAppDeps {
  logger: Logger;
  metrics: Metrics;
  service: AnalysisService;
  readiness?: (() => Promise<boolean> | boolean) | undefined;
}

export async function buildApp(deps: BuildAppDeps): Promise<AppServer> {
  const app = await createServer({
    logger: deps.logger,
    metrics: deps.metrics,
    readiness: deps.readiness,
  });
  registerAnalyzeRoutes(app, { service: deps.service });
  return app;
}
