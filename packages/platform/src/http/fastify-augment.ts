import 'fastify';

/**
 * Adds request-scoped correlation and trace ids to every Fastify request.
 * Set by the `onRequest` hook in {@link createServer}.
 */
declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    traceId: string;
  }
}
