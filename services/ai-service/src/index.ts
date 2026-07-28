import {
  connectEventBus,
  createIdempotencyStore,
  createLogger,
  createMetrics,
  createRedis,
  loadEnv,
} from '@cx-orbit/platform';
import { buildApp } from './app.js';
import { envSchema } from './config.js';
import { startConsumers } from './consumers/index.js';
import { createAiMetrics } from './metrics.js';
import { createAIProvider } from './providers/index.js';
import { createAnalysisService } from './service/analysis-service.js';

const SERVICE = 'ai-service';

async function main(): Promise<void> {
  const config = loadEnv(envSchema);
  const logger = createLogger({ service: SERVICE, level: config.LOG_LEVEL });
  const metrics = createMetrics(SERVICE);
  const domainMetrics = createAiMetrics(metrics.registry);

  const provider = createAIProvider(config);
  logger.info(
    { provider: provider.name, forceFailure: config.AI_FORCE_FAILURE },
    'AI provider selected',
  );

  const redis = createRedis({ url: config.REDIS_URL });
  const idempotency = createIdempotencyStore(redis, {
    defaultTtlSeconds: config.IDEMPOTENCY_TTL_SECONDS,
  });
  const eventBus = await connectEventBus({ url: config.NATS_URL, streamName: config.NATS_STREAM });

  const service = createAnalysisService({
    provider,
    bus: eventBus,
    idempotency,
    metrics: domainMetrics,
    logger,
    minConfidence: config.AI_MIN_CONFIDENCE,
    timeoutMs: config.AI_TIMEOUT_MS,
    idempotencyTtlSeconds: config.IDEMPOTENCY_TTL_SECONDS,
  });

  const consumer = await startConsumers(eventBus, service, domainMetrics, logger, {
    durable: config.CONSUMER_DURABLE,
    maxDeliver: config.CONSUMER_MAX_DELIVER,
  });

  const app = await buildApp({
    logger,
    metrics,
    service,
    readiness: async () => {
      try {
        await redis.ping();
        return !eventBus.connection.isClosed();
      } catch {
        return false;
      }
    },
  });

  await app.listen({ host: config.HOST, port: config.AI_SERVICE_PORT });
  logger.info({ port: config.AI_SERVICE_PORT, natsUrl: config.NATS_URL }, 'ai-service listening');

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down ai-service');
    try {
      await consumer.stop();
      await app.close();
      await eventBus.close();
      redis.disconnect();
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
  console.error('ai-service failed to start', err);
  process.exit(1);
});
