import { type AppServer, type Logger, type Metrics, createServer } from '@cx-orbit/platform';
import type { Aggregator } from './aggregator.js';

export interface BuildAppDeps {
  logger: Logger;
  metrics: Metrics;
  aggregator: Aggregator;
  readiness?: (() => Promise<boolean> | boolean) | undefined;
}

export async function buildApp(deps: BuildAppDeps): Promise<AppServer> {
  const app = await createServer({
    logger: deps.logger,
    metrics: deps.metrics,
    readiness: deps.readiness,
  });

  app.get('/summary', async () => {
    const snap = deps.aggregator.snapshot();
    const handoffRate =
      snap.routingDecisions === 0 ? 0 : snap.routingHandoffs / snap.routingDecisions;
    const aiContainmentRate =
      snap.aiAnalyses === 0 ? 0 : 1 - snap.aiLowConfidence / snap.aiAnalyses;
    const deliverySuccessRate =
      snap.deliveriesSent + snap.deliveriesFailed === 0
        ? 0
        : snap.deliveriesSent / (snap.deliveriesSent + snap.deliveriesFailed);

    return {
      business: {
        messagesInbound: snap.messagesInbound,
        messagesOutbound: snap.messagesOutbound,
        conversationsCreated: snap.conversationsCreated,
        conversationsResolved: snap.conversationsResolved,
        customersCreated: snap.customersCreated,
        aiAnalyses: snap.aiAnalyses,
        aiContainmentRate,
        routingDecisions: snap.routingDecisions,
        handoffRate,
        deliverySuccessRate,
      },
      technical: {
        eventsByType: snap.eventsByType,
        deliveriesFailed: snap.deliveriesFailed,
        aiLowConfidence: snap.aiLowConfidence,
        routingHandoffs: snap.routingHandoffs,
      },
    };
  });

  return app;
}
