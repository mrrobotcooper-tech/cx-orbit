import { baseEnvSchema } from '@cx-orbit/platform';
import { z } from 'zod';

/**
 * Environment contract for the Channel Gateway. Extends the shared base schema
 * (LOG_LEVEL, NODE_ENV, ...) with the transport endpoints and tuning knobs this
 * service needs. Validation is fail-fast: a bad env aborts boot.
 */
export const envSchema = baseEnvSchema.extend({
  HOST: z.string().default('0.0.0.0'),
  CHANNEL_GATEWAY_PORT: z.coerce.number().int().positive().default(8080),
  NATS_URL: z.string().default('nats://localhost:4222'),
  NATS_STREAM: z.string().default('CXORBIT'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /** Optional shared secret; when set, every webhook must send `x-webhook-token`. */
  WEBHOOK_SECRET: z.string().min(1).optional(),
  /** TTL for the inbound idempotency key (dedupes provider retries). */
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
});

export type GatewayEnv = z.infer<typeof envSchema>;
