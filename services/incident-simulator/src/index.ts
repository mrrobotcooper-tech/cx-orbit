import {
  connectEventBus,
  createFaultStore,
  createLogger,
  createMetrics,
  createRedis,
  loadEnv,
} from '@cx-orbit/platform';
import { buildApp } from './app.js';
import { envSchema } from './config.js';
import { createIncidentEngine } from './engine.js';
import { createIncidentMetrics } from './metrics.js';

const SERVICE = 'incident-simulator';

async function main(): Promise<void> {
  const config = loadEnv(envSchema);
  const logger = createLogger({ service: SERVICE, level: config.LOG_LEVEL });
  const metrics = createMetrics(SERVICE);
  const domainMetrics = createIncidentMetrics(metrics.registry);

  const redis = createRedis({ url: config.REDIS_URL });
  const faults = createFaultStore(redis);
  const eventBus = await connectEventBus({ url: config.NATS_URL, streamName: config.NATS_STREAM });

  const engine = createIncidentEngine({
    bus: eventBus,
    faults,
    metrics: domainMetrics,
    logger,
    defaults: {
      queueBacklogCount: config.QUEUE_BACKLOG_DEFAULT_COUNT,
      dbLatencyMs: config.DB_LATENCY_DEFAULT_MS,
    },
  });

  const app = await buildApp({
    logger,
    metrics,
    engine,
    readiness: async () => {
      try {
        await redis.ping();
        return !eventBus.connection.isClosed();
      } catch {
        return false;
      }
    },
  });

  await app.listen({ host: config.HOST, port: config.INCIDENT_SIMULATOR_PORT });
  logger.info(
    { port: config.INCIDENT_SIMULATOR_PORT, natsUrl: config.NATS_URL },
    'incident-simulator listening',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down incident-simulator');
    try {
      await engine.stopAll('manual');
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
  console.error('incident-simulator failed to start', err);
  process.exit(1);
});
