import { type AppServer, getRequestContext } from '@cx-orbit/platform';
import { CHANNELS, type Channel, EventValidationError } from '@cx-orbit/shared';
import { ZodError } from 'zod';
import type { InboundAdapter } from '../adapters/index.js';
import type { IngestService } from '../ingest.js';
import type { GatewayMetrics } from '../metrics.js';

const channelSet = new Set<string>(CHANNELS);

export interface WebhookRoutesDeps {
  adapters: Record<Channel, InboundAdapter>;
  ingest: IngestService;
  metrics: GatewayMetrics;
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      out[key] = value;
    } else if (Array.isArray(value) && value[0] !== undefined) {
      out[key] = value[0];
    }
  }
  return out;
}

/**
 * Register the single provider ingress endpoint. Providers POST their native
 * webhook body to `/webhooks/:channel`; the matching adapter authenticates and
 * normalizes it, then the ingest pipeline dedupes and publishes. We ack fast.
 */
export function registerWebhookRoutes(app: AppServer, deps: WebhookRoutesDeps): void {
  app.post<{ Params: { channel: string } }>('/webhooks/:channel', async (req, reply) => {
    const { channel } = req.params;

    if (!channelSet.has(channel)) {
      reply.code(404);
      return { error: { code: 'unknown_channel', message: `Unknown channel: ${channel}` } };
    }

    const adapter = deps.adapters[channel as Channel];
    const headers = normalizeHeaders(req.headers);

    const authorized = await adapter.validateWebhook(req.body, headers);
    if (!authorized) {
      deps.metrics.errors.inc({ channel, reason: 'unauthorized' });
      reply.code(401);
      return { error: { code: 'unauthorized', message: 'Invalid webhook signature/token' } };
    }

    const ctx = getRequestContext(req);
    try {
      const result = await deps.ingest.ingest(adapter, req.body, ctx);
      reply.code(result.status === 'duplicate' ? 200 : 202);
      return {
        status: result.status,
        ...(result.eventId !== undefined ? { eventId: result.eventId } : {}),
        correlationId: ctx.correlationId,
      };
    } catch (err) {
      if (err instanceof ZodError || err instanceof EventValidationError) {
        deps.metrics.errors.inc({ channel, reason: 'invalid_payload' });
        reply.code(400);
        return { error: { code: 'invalid_payload', message: 'Webhook payload failed validation' } };
      }
      deps.metrics.errors.inc({ channel, reason: 'internal_error' });
      req.log.error({ err }, 'inbound ingest failed');
      reply.code(500);
      return { error: { code: 'internal_error', message: 'Failed to process webhook' } };
    }
  });
}
