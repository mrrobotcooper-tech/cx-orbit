import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildWebchatApp } from '../src/app.js';

describe('webchat-provider contract', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const built = await buildWebchatApp({ timeoutDelayMs: 5 });
    app = built.app;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a valid outbound message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messages',
      payload: { to: 'visitor_1', text: 'hola', idempotencyKey: 'k1' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('delivered');
    expect(body.providerMessageId).toMatch(/^wcsim_/);
  });

  it('returns 429 for rate_limit fault', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-simulate-fault': 'rate_limit' },
      payload: { to: 'visitor_1', text: 'hola' },
    });
    expect(res.statusCode).toBe(429);
  });

  it('returns 500 for error fault', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-simulate-fault': 'error' },
      payload: { to: 'visitor_1', text: 'hola' },
    });
    expect(res.statusCode).toBe(500);
  });

  it('returns 400 for invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/messages',
      payload: { to: '', text: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});
