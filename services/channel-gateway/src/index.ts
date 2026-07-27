import {
  connectEventBus,
  createIdempotencyStore,
  createLogger,
  createMetrics,
  createRedis,
  loadEnv,
} from '@cx-orbit/platform';
import { buildApp } from './app.js';
import { createAdapters } from './adapters/index.js';
import { envSchema } from './config.js';

const SERVICE = 'channel-gateway';

async function main(): Promise<void> {
  const config = loadEnv(envSchema);
  const logger = createLogger({ service: SERVICE, level: config.LOG_LEVEL });
  const metrics = createMetrics(SERVICE);

  const redis = createRedis({ url: config.REDIS_URL });
  const idempotency = createIdempotencyStore(redis, {
    defaultTtlSeconds: config.IDEMPOTENCY_TTL_SECONDS,
  });
  const eventBus = await connectEventBus({
    url: config.NATS_URL,
    streamName: config.NATS_STREAM,
  });

  const adapters = createAdapters(
    config.WEBHOOK_SECRET !== undefined ? { secret: config.WEBHOOK_SECRET } : {},
  );

  const app = await buildApp({
    logger,
    metrics,
    publisher: eventBus,
    idempotency,
    adapters,
    idempotencyTtlSeconds: config.IDEMPOTENCY_TTL_SECONDS,
    readiness: async () => {
      try {
        await redis.ping();
        return !eventBus.connection.isClosed();
      } catch {
        return false;
      }
    },
  });

  await app.listen({ host: config.HOST, port: config.CHANNEL_GATEWAY_PORT });
  logger.info(
    { port: config.CHANNEL_GATEWAY_PORT, natsUrl: config.NATS_URL, redisUrl: config.REDIS_URL },
    'channel-gateway listening',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down channel-gateway');
    try {
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
  // Boot failure: nothing is wired yet, so log to stderr and exit non-zero.
  console.error('channel-gateway failed to start', err);
  process.exit(1);
});
