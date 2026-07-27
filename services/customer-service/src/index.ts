import {
  connectEventBus,
  connectPostgres,
  createLogger,
  createMetrics,
  loadEnv,
} from '@cx-orbit/platform';
import { buildApp } from './app.js';
import { startConsumers } from './consumers/index.js';
import { ensureSchema } from './db/schema.js';
import { createCustomerMetrics } from './metrics.js';
import { createOutboxRelay } from './outbox/relay.js';
import { createCustomerService } from './service/customer-service.js';
import { envSchema } from './config.js';

const SERVICE = 'customer-service';

async function main(): Promise<void> {
  const config = loadEnv(envSchema);
  const logger = createLogger({ service: SERVICE, level: config.LOG_LEVEL });
  const metrics = createMetrics(SERVICE);
  const domainMetrics = createCustomerMetrics(metrics.registry);

  const pg = await connectPostgres({ connectionString: config.POSTGRES_URL });
  await ensureSchema(pg);
  logger.info('postgres connected and schema ensured');

  const eventBus = await connectEventBus({ url: config.NATS_URL, streamName: config.NATS_STREAM });

  const relay = createOutboxRelay(eventBus, pg, domainMetrics, logger, {
    pollIntervalMs: config.OUTBOX_POLL_INTERVAL_MS,
    batchSize: config.OUTBOX_BATCH_SIZE,
  });

  const service = createCustomerService({
    pg,
    metrics: domainMetrics,
    logger,
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
    defaultPageSize: config.DEFAULT_PAGE_SIZE,
    maxPageSize: config.MAX_PAGE_SIZE,
    readiness: async () => {
      try {
        await pg.query('SELECT 1');
        return !eventBus.connection.isClosed();
      } catch {
        return false;
      }
    },
  });

  await app.listen({ host: config.HOST, port: config.CUSTOMER_SERVICE_PORT });
  logger.info(
    { port: config.CUSTOMER_SERVICE_PORT, natsUrl: config.NATS_URL },
    'customer-service listening',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down customer-service');
    try {
      await consumer.stop();
      await relay.stop();
      await app.close();
      await eventBus.close();
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
  console.error('customer-service failed to start', err);
  process.exit(1);
});
