import { baseEnvSchema } from '@cx-orbit/platform';
import { z } from 'zod';

/**
 * Environment contract for the Customer Service. Postgres defaults to the host
 * port mapping (5433) so a host-run service works out of the box.
 */
export const envSchema = baseEnvSchema.extend({
  HOST: z.string().default('0.0.0.0'),
  CUSTOMER_SERVICE_PORT: z.coerce.number().int().positive().default(8082),

  POSTGRES_URL: z.string().default('postgresql://cxorbit:cxorbit@localhost:5433/cxorbit'),

  NATS_URL: z.string().default('nats://localhost:4222'),
  NATS_STREAM: z.string().default('CXORBIT'),

  CONSUMER_DURABLE: z.string().default('customer-service'),
  CONSUMER_MAX_DELIVER: z.coerce.number().int().positive().default(5),

  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(50),

  DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().max(200).default(20),
  MAX_PAGE_SIZE: z.coerce.number().int().positive().max(500).default(100),
});

export type CustomerEnv = z.infer<typeof envSchema>;
