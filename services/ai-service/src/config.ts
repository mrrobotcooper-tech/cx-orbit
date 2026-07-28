import { baseEnvSchema } from '@cx-orbit/platform';
import { z } from 'zod';

export const AI_FAILURE_MODES = [
  'NONE',
  'LOW_CONFIDENCE',
  'INVALID_JSON',
  'TIMEOUT',
  'RATE_LIMIT',
  'HALLUCINATION',
  'PROVIDER_ERROR',
] as const;

export const envSchema = baseEnvSchema.extend({
  HOST: z.string().default('0.0.0.0'),
  AI_SERVICE_PORT: z.coerce.number().int().positive().default(8083),

  NATS_URL: z.string().default('nats://localhost:4222'),
  NATS_STREAM: z.string().default('CXORBIT'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  CONSUMER_DURABLE: z.string().default('ai-service'),
  CONSUMER_MAX_DELIVER: z.coerce.number().int().positive().default(5),

  /** mock | openai | anthropic | local — only mock is implemented in Phase 6. */
  AI_PROVIDER: z.enum(['mock', 'openai', 'anthropic', 'local']).default('mock'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  AI_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.7),
  /** Force a failure mode for demos / incident simulation (ADR-008). */
  AI_FORCE_FAILURE: z.enum(AI_FAILURE_MODES).default('NONE'),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
});

export type AiEnv = z.infer<typeof envSchema>;
export type AiFailureMode = (typeof AI_FAILURE_MODES)[number];
