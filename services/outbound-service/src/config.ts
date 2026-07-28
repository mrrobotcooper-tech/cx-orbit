import { baseEnvSchema } from '@cx-orbit/platform';
import { z } from 'zod';

export const envSchema = baseEnvSchema.extend({
  HOST: z.string().default('0.0.0.0'),
  OUTBOUND_SERVICE_PORT: z.coerce.number().int().positive().default(8085),

  NATS_URL: z.string().default('nats://localhost:4222'),
  NATS_STREAM: z.string().default('CXORBIT'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  CONSUMER_DURABLE: z.string().default('outbound-service'),
  CONSUMER_MAX_DELIVER: z.coerce.number().int().positive().default(5),

  OUTBOUND_MAX_RETRIES: z.coerce.number().int().positive().default(4),
  OUTBOUND_BASE_BACKOFF_MS: z.coerce.number().int().positive().default(200),
  OUTBOUND_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  CIRCUIT_BREAKER_MIN_REQUESTS: z.coerce.number().int().positive().default(5),
  CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().positive().default(15_000),

  WEBCHAT_PROVIDER_URL: z.string().default('http://localhost:9107'),
  /** Optional fault injected into outbound calls to the webchat simulator. */
  WEBCHAT_SIMULATE_FAULT: z.enum(['none', 'timeout', 'error', 'rate_limit']).default('none'),

  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  DLQ_MAX_ENTRIES: z.coerce.number().int().positive().default(1000),
});

export type OutboundEnv = z.infer<typeof envSchema>;
