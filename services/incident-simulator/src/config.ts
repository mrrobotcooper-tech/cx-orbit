import { baseEnvSchema } from '@cx-orbit/platform';
import { z } from 'zod';

export const envSchema = baseEnvSchema.extend({
  HOST: z.string().default('0.0.0.0'),
  INCIDENT_SIMULATOR_PORT: z.coerce.number().int().positive().default(8087),

  NATS_URL: z.string().default('nats://localhost:4222'),
  NATS_STREAM: z.string().default('CXORBIT'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  /** Default flood size for QUEUE_BACKLOG when params.count is omitted. */
  QUEUE_BACKLOG_DEFAULT_COUNT: z.coerce.number().int().positive().default(50),
  /** Default artificial DB delay (ms) for DATABASE_LATENCY. */
  DB_LATENCY_DEFAULT_MS: z.coerce.number().int().positive().default(2000),
});

export type IncidentEnv = z.infer<typeof envSchema>;
