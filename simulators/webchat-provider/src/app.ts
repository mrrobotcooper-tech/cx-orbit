import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';

/**
 * Minimal WebChat provider simulator. Supports fault injection via header
 * `x-simulate-fault: timeout | error | rate_limit` for outbound resilience demos.
 */
const bodySchema = z.object({
  to: z.string().min(1),
  text: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
});

export interface WebchatAppOptions {
  /** Artificial timeout delay when x-simulate-fault=timeout. Default 60s (prod-like). */
  timeoutDelayMs?: number;
}

export interface WebchatApp {
  app: FastifyInstance;
  delivered: Array<Record<string, unknown>>;
}

export async function buildWebchatApp(options: WebchatAppOptions = {}): Promise<WebchatApp> {
  const timeoutDelayMs = options.timeoutDelayMs ?? 60_000;
  const app = Fastify({ logger: false });
  const delivered: Array<Record<string, unknown>> = [];

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/messages', async () => ({ data: delivered.slice(-50) }));

  app.post('/v1/messages', async (req, reply) => {
    const fault = String(req.headers['x-simulate-fault'] ?? '');
    if (fault === 'timeout') {
      await new Promise((r) => setTimeout(r, timeoutDelayMs));
    }
    if (fault === 'rate_limit') {
      reply.code(429);
      return { error: 'rate_limited' };
    }
    if (fault === 'error') {
      reply.code(500);
      return { error: 'provider_error' };
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_body', issues: parsed.error.issues };
    }

    const providerMessageId = `wcsim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    delivered.push({
      ...parsed.data,
      providerMessageId,
      receivedAt: new Date().toISOString(),
    });
    reply.code(201);
    return { providerMessageId, status: 'delivered' };
  });

  return { app, delivered };
}
