import { baseEnvSchema } from '@cx-orbit/platform';
import { z } from 'zod';

export const envSchema = baseEnvSchema.extend({
  HOST: z.string().default('0.0.0.0'),
  ANALYTICS_SERVICE_PORT: z.coerce.number().int().positive().default(8086),

  NATS_URL: z.string().default('nats://localhost:4222'),
  NATS_STREAM: z.string().default('CXORBIT'),

  CONSUMER_DURABLE: z.string().default('analytics-service'),
  CONSUMER_MAX_DELIVER: z.coerce.number().int().positive().default(5),

  /** How often to refresh JetStream consumer lag gauges, in ms. */
  LAG_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
});

export type AnalyticsEnv = z.infer<typeof envSchema>;
