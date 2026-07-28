import {
  connectEventBus,
  connectPostgres,
  createIdempotencyStore,
  createLogger,
  createMetrics,
  createRedis,
  loadEnv,
} from '@cx-orbit/platform';
import { buildApp } from './app.js';
import { envSchema } from './config.js';
import { startConsumers } from './consumers/index.js';
import { ensureSchema, loadIntentRules } from './db/schema.js';
import { createRoutingMetrics } from './metrics.js';
import { createOutboxRelay } from './outbox/relay.js';
import { createRoutingService } from './service/routing-service.js';

const SERVICE = 'routing-service';

async function main(): Promise<void> {
  const config = loadEnv(envSchema);
  const logger = createLogger({ service: SERVICE, level: config.LOG_LEVEL });
  const metrics = createMetrics(SERVICE);
  const domainMetrics = createRoutingMetrics(metrics.registry);

  const pg = await connectPostgres({ connectionString: config.POSTGRES_URL });
  await ensureSchema(pg);
  logger.info('postgres connected and routing schema ensured');

  const redis = createRedis({ url: config.REDIS_URL });
  const idempotency = createIdempotencyStore(redis, {
    defaultTtlSeconds: config.IDEMPOTENCY_TTL_SECONDS,
  });
  const eventBus = await connectEventBus({ url: config.NATS_URL, streamName: config.NATS_STREAM });

  const relay = createOutboxRelay(eventBus, pg, domainMetrics, logger, {
    pollIntervalMs: config.OUTBOX_POLL_INTERVAL_MS,
    batchSize: config.OUTBOX_BATCH_SIZE,
  });

  const service = createRoutingService({
    pg,
    idempotency,
    metrics: domainMetrics,
    logger,
    minConfidence: config.ROUTING_MIN_CONFIDENCE,
    loadRules: () => loadIntentRules(pg),
    idempotencyTtlSeconds: config.IDEMPOTENCY_TTL_SECONDS,
    notifyOutbox: () => {
      void relay.pump();
    },
  });

  relay.start();

  const consumer = await startConsumers(eventBus, service, domainMetrics, logger, {
    durable: config.CONSUMER_DURABLE,
    maxDeliver: config.CONSUMER_MAX_DELIVER,
  });

  const app = await buildApp({
    logger,
    metrics,
    pg,
    service,
    readiness: async () => {
      try {
        await pg.query('SELECT 1');
        await redis.ping();
        return !eventBus.connection.isClosed();
      } catch {
        return false;
      }
    },
  });

  await app.listen({ host: config.HOST, port: config.ROUTING_SERVICE_PORT });
  logger.info(
    { port: config.ROUTING_SERVICE_PORT, minConfidence: config.ROUTING_MIN_CONFIDENCE },
    'routing-service listening',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down routing-service');
    try {
      await consumer.stop();
      await relay.stop();
      await app.close();
      await eventBus.close();
      redis.disconnect();
      await pg.close();
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
  console.error('routing-service failed to start', err);
  process.exit(1);
});
