import {
  connectEventBus,
  connectMongo,
  createFaultStore,
  createLogger,
  createMetrics,
  createRedis,
  loadEnv,
} from '@cx-orbit/platform';
import { buildApp } from './app.js';
import { getCollections, ensureIndexes } from './db/collections.js';
import { startConsumers } from './consumers/index.js';
import { createConversationMetrics } from './metrics.js';
import { createOutboxRelay } from './outbox/relay.js';
import { createConversationService } from './service/conversation-service.js';
import { envSchema } from './config.js';

const SERVICE = 'conversation-service';

async function main(): Promise<void> {
  const config = loadEnv(envSchema);
  const logger = createLogger({ service: SERVICE, level: config.LOG_LEVEL });
  const metrics = createMetrics(SERVICE);
  const domainMetrics = createConversationMetrics(metrics.registry);

  const mongo = await connectMongo({ uri: config.MONGO_URI, dbName: config.MONGO_DB });
  const collections = getCollections(mongo.db);
  await ensureIndexes(collections);
  logger.info('mongo connected and indexes ensured');

  const redis = createRedis({ url: config.REDIS_URL });
  const faults = createFaultStore(redis);
  const eventBus = await connectEventBus({ url: config.NATS_URL, streamName: config.NATS_STREAM });

  const relay = createOutboxRelay(eventBus, collections, domainMetrics, logger, {
    pollIntervalMs: config.OUTBOX_POLL_INTERVAL_MS,
    batchSize: config.OUTBOX_BATCH_SIZE,
    faults,
  });

  const service = createConversationService({
    client: mongo.client,
    collections,
    metrics: domainMetrics,
    logger,
    faults,
    notifyOutbox: () => {
      void relay.pump();
    },
  });

  relay.start();

  const consumer = await startConsumers(eventBus, collections, service, domainMetrics, logger, {
    durable: config.CONSUMER_DURABLE,
    maxDeliver: config.CONSUMER_MAX_DELIVER,
  });

  const app = await buildApp({
    logger,
    metrics,
    collections,
    service,
    defaultPageSize: config.DEFAULT_PAGE_SIZE,
    maxPageSize: config.MAX_PAGE_SIZE,
    readiness: async () => {
      try {
        await mongo.db.command({ ping: 1 });
        return !eventBus.connection.isClosed();
      } catch {
        return false;
      }
    },
  });

  await app.listen({ host: config.HOST, port: config.CONVERSATION_SERVICE_PORT });
  logger.info(
    { port: config.CONVERSATION_SERVICE_PORT, mongo: config.MONGO_DB, natsUrl: config.NATS_URL },
    'conversation-service listening',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down conversation-service');
    try {
      await consumer.stop();
      await relay.stop();
      await app.close();
      await eventBus.close();
      redis.disconnect();
      await mongo.close();
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
  console.error('conversation-service failed to start', err);
  process.exit(1);
});
