import { connectEventBus, createLogger, createMetrics, loadEnv } from '@cx-orbit/platform';
import { createAggregator } from './aggregator.js';
import { buildApp } from './app.js';
import { envSchema } from './config.js';
import { startConsumers, startLagPoller } from './consumers/index.js';
import { createAnalyticsMetrics } from './metrics.js';

const SERVICE = 'analytics-service';

async function main(): Promise<void> {
  const config = loadEnv(envSchema);
  const logger = createLogger({ service: SERVICE, level: config.LOG_LEVEL });
  const metrics = createMetrics(SERVICE);
  const domainMetrics = createAnalyticsMetrics(metrics.registry);
  const aggregator = createAggregator(domainMetrics);

  const eventBus = await connectEventBus({ url: config.NATS_URL, streamName: config.NATS_STREAM });

  const consumer = await startConsumers(eventBus, aggregator, logger, {
    durable: config.CONSUMER_DURABLE,
    maxDeliver: config.CONSUMER_MAX_DELIVER,
  });

  const lagPoller = startLagPoller(
    eventBus,
    config.CONSUMER_DURABLE,
    domainMetrics,
    logger,
    config.LAG_POLL_INTERVAL_MS,
  );

  const app = await buildApp({
    logger,
    metrics,
    aggregator,
    readiness: async () => !eventBus.connection.isClosed(),
  });

  await app.listen({ host: config.HOST, port: config.ANALYTICS_SERVICE_PORT });
  logger.info({ port: config.ANALYTICS_SERVICE_PORT }, 'analytics-service listening');

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down analytics-service');
    try {
      lagPoller.stop();
      await consumer.stop();
      await app.close();
      await eventBus.close();
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  console.error('analytics-service failed to start', err);
  process.exit(1);
});
