import { type AppServer, getRequestContext } from '@cx-orbit/platform';
import { ChannelSchema, MessageContentSchema, createEvent } from '@cx-orbit/shared';
import { z } from 'zod';
import type { DeadLetterQueue } from '../dlq.js';
import type { DeliveryService } from '../service/delivery-service.js';

export interface OutboundRoutesDeps {
  service: DeliveryService;
  dlq: DeadLetterQueue;
}

const sendBodySchema = z.object({
  conversationId: z.string().min(1),
  channel: ChannelSchema,
  recipientExternalId: z.string().min(1),
  content: MessageContentSchema,
  idempotencyKey: z.string().min(1),
});

export function registerOutboundRoutes(app: AppServer, deps: OutboundRoutesDeps): void {
  app.post('/send', async (req, reply) => {
    const parsed = sendBodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: { code: 'invalid_body', issues: parsed.error.issues } };
    }
    const ctx = getRequestContext(req);
    const event = createEvent({
      eventType: 'message.send.requested',
      source: 'outbound-service-http',
      correlationId: ctx.correlationId,
      traceId: ctx.traceId,
      payload: parsed.data,
    });
    const result = await deps.service.handleSendRequested(event);
    reply.code(result.status === 'sent' ? 202 : result.status === 'duplicate' ? 200 : 502);
    return { ...result, correlationId: ctx.correlationId };
  });

  app.get('/dlq', async (req) => {
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 50) || 50, 200);
    return { data: await deps.dlq.list(limit), size: await deps.dlq.size() };
  });

  app.get<{ Params: { channel: string } }>('/circuits/:channel', async (req, reply) => {
    try {
      const state = deps.service.getCircuitState(req.params.channel as never);
      return { channel: req.params.channel, state };
    } catch {
      reply.code(404);
      return { error: { code: 'unknown_channel' } };
    }
  });
}
