import {
  connectEventBus,
  createFaultStore,
  createIdempotencyStore,
  createLogger,
  createMetrics,
  createRedis,
  FAULT_KEYS,
  loadEnv,
} from '@cx-orbit/platform';
import { createOutboundAdapters, type WebChatSimulateFault } from './adapters/index.js';
import { buildApp } from './app.js';
import { envSchema } from './config.js';
import { startConsumers } from './consumers/index.js';
import { createDeadLetterQueue } from './dlq.js';
import { createOutboundMetrics } from './metrics.js';
import { createDeliveryService } from './service/delivery-service.js';

const SERVICE = 'outbound-service';

const WEBCHAT_FAULTS = new Set<WebChatSimulateFault>(['none', 'timeout', 'error', 'rate_limit']);

async function main(): Promise<void> {
  const config = loadEnv(envSchema);
  const logger = createLogger({ service: SERVICE, level: config.LOG_LEVEL });
  const metrics = createMetrics(SERVICE);
  const domainMetrics = createOutboundMetrics(metrics.registry);

  const redis = createRedis({ url: config.REDIS_URL });
  const faults = createFaultStore(redis);
  const idempotency = createIdempotencyStore(redis, {
    defaultTtlSeconds: config.IDEMPOTENCY_TTL_SECONDS,
  });
  const dlq = createDeadLetterQueue(redis, { maxEntries: config.DLQ_MAX_ENTRIES });
  const eventBus = await connectEventBus({ url: config.NATS_URL, streamName: config.NATS_STREAM });

  const adapters = createOutboundAdapters({
    webchat: {
      baseUrl: config.WEBCHAT_PROVIDER_URL,
      simulateFault: config.WEBCHAT_SIMULATE_FAULT,
      getSimulateFault: async () => {
        const raw = await faults.get(FAULT_KEYS.WEBCHAT_SIMULATE);
        if (raw && WEBCHAT_FAULTS.has(raw as WebChatSimulateFault)) {
          return raw as WebChatSimulateFault;
        }
        return 'none';
      },
    },
  });

  const service = createDeliveryService({
    adapters,
    bus: eventBus,
    idempotency,
    dlq,
    metrics: domainMetrics,
    logger,
    maxRetries: config.OUTBOUND_MAX_RETRIES,
    baseBackoffMs: config.OUTBOUND_BASE_BACKOFF_MS,
    timeoutMs: config.OUTBOUND_TIMEOUT_MS,
    breakerFailureThreshold: config.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    breakerMinRequests: config.CIRCUIT_BREAKER_MIN_REQUESTS,
    breakerResetMs: config.CIRCUIT_BREAKER_RESET_MS,
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
    dlq,
    readiness: async () => {
      try {
        await redis.ping();
        return !eventBus.connection.isClosed();
      } catch {
        return false;
      }
    },
  });

  await app.listen({ host: config.HOST, port: config.OUTBOUND_SERVICE_PORT });
  logger.info(
    {
      port: config.OUTBOUND_SERVICE_PORT,
      webchatProvider: config.WEBCHAT_PROVIDER_URL,
      simulateFault: config.WEBCHAT_SIMULATE_FAULT,
    },
    'outbound-service listening',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down outbound-service');
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
  console.error('outbound-service failed to start', err);
  process.exit(1);
});
