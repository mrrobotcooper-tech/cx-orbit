import Fastify, { type FastifyRequest } from 'fastify';
import { newCorrelationId, newTraceId } from '@cx-orbit/shared';
import type { Logger } from '../logger.js';
import type { Metrics } from '../metrics.js';
import './fastify-augment.js';

export interface CreateServerOptions {
  logger: Logger;
  metrics: Metrics;
  /** Readiness probe: return false to make `/ready` respond 503. */
  readiness?: (() => Promise<boolean> | boolean) | undefined;
}

export interface RequestContext {
  correlationId: string;
  traceId: string;
}

/** Read the correlation/trace context attached to a request. */
export function getRequestContext(req: FastifyRequest): RequestContext {
  return { correlationId: req.correlationId, traceId: req.traceId };
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Build a Fastify server pre-wired with:
 *  - structured logging (Pino),
 *  - correlationId/traceId propagation (in from headers or generated, echoed out),
 *  - RED HTTP metrics,
 *  - /health (liveness), /ready (readiness), /metrics (Prometheus).
 */
export async function createServer(options: CreateServerOptions) {
  const app = Fastify({
    loggerInstance: options.logger,
    genReqId: (req) => firstHeader(req.headers['x-correlation-id']) ?? newCorrelationId(),
  });

  app.decorateRequest('correlationId', '');
  app.decorateRequest('traceId', '');

  app.addHook('onRequest', async (req, reply) => {
    const correlationId = firstHeader(req.headers['x-correlation-id']) ?? req.id;
    const traceId = firstHeader(req.headers['x-trace-id']) ?? newTraceId();
    req.correlationId = correlationId;
    req.traceId = traceId;
    reply.header('x-correlation-id', correlationId);
    reply.header('x-trace-id', traceId);
  });

  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions.url ?? req.url;
    const labels = {
      method: req.method,
      route,
      status: String(reply.statusCode),
    };
    options.metrics.httpRequestsTotal.inc(labels);
    options.metrics.httpRequestDurationSeconds.observe(labels, reply.elapsedTime / 1000);
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_req, reply) => {
    const ready = options.readiness ? await options.readiness() : true;
    if (!ready) {
      reply.code(503);
      return { status: 'not_ready' };
    }
    return { status: 'ready' };
  });

  app.get('/metrics', async (_req, reply) => {
    reply.header('content-type', options.metrics.registry.contentType);
    return options.metrics.registry.metrics();
  });

  return app;
}

/** The concrete Fastify instance type returned by {@link createServer}. */
export type AppServer = Awaited<ReturnType<typeof createServer>>;
