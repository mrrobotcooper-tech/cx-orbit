/**
 * @cx-orbit/platform — service runtime kit.
 *
 * Cross-cutting building blocks every CX-ORBIT service reuses: configuration,
 * structured logging, metrics, a pre-wired Fastify server, the NATS JetStream
 * event bus and Redis helpers (cache + idempotency). Contains no business
 * logic (ADR-009 / ADR-010).
 */
export * from './config.js';
export * from './logger.js';
export * from './metrics.js';
export * from './http/server.js';
export * from './messaging/nats.js';
export * from './messaging/consumer.js';
export * from './cache/redis.js';
export * from './cache/idempotency.js';
export * from './db/mongo.js';
export * from './db/postgres.js';
