import { baseEnvSchema } from '@cx-orbit/platform';
import { z } from 'zod';

/**
 * Environment contract for the Conversation Service. Fail-fast validation.
 * Mongo defaults to the single-node replica set exposed on the host with
 * `directConnection=true` so transactions work without host advertisement pain.
 */
export const envSchema = baseEnvSchema.extend({
  HOST: z.string().default('0.0.0.0'),
  CONVERSATION_SERVICE_PORT: z.coerce.number().int().positive().default(8081),

  MONGO_URI: z.string().default('mongodb://localhost:27017/cxorbit?directConnection=true'),
  MONGO_DB: z.string().default('cxorbit'),

  NATS_URL: z.string().default('nats://localhost:4222'),
  NATS_STREAM: z.string().default('CXORBIT'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  CONSUMER_DURABLE: z.string().default('conversation-service'),
  CONSUMER_MAX_DELIVER: z.coerce.number().int().positive().default(5),

  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(50),

  DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().max(200).default(20),
  MAX_PAGE_SIZE: z.coerce.number().int().positive().max(500).default(100),
});

export type ConversationEnv = z.infer<typeof envSchema>;
