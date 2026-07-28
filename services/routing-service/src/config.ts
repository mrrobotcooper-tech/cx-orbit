import { baseEnvSchema } from '@cx-orbit/platform';
import { z } from 'zod';

export const envSchema = baseEnvSchema.extend({
  HOST: z.string().default('0.0.0.0'),
  ROUTING_SERVICE_PORT: z.coerce.number().int().positive().default(8084),

  POSTGRES_URL: z.string().default('postgresql://cxorbit:cxorbit@localhost:5433/cxorbit'),
  NATS_URL: z.string().default('nats://localhost:4222'),
  NATS_STREAM: z.string().default('CXORBIT'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  CONSUMER_DURABLE: z.string().default('routing-service'),
  CONSUMER_MAX_DELIVER: z.coerce.number().int().positive().default(5),

  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(50),

  /** Confidence below this → human handoff (aligns with AI_MIN_CONFIDENCE). */
  ROUTING_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.7),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
});

export type RoutingEnv = z.infer<typeof envSchema>;
