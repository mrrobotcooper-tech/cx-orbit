import { createLogger, createMetrics } from '@cx-orbit/platform';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createAdapters } from '../src/adapters/index.js';
import { createFakeIdempotency, createFakePublisher } from './helpers.js';
import type { AppServer } from '@cx-orbit/platform';

const logger = createLogger({ service: 'channel-gateway-test', level: 'silent' });

function webChatBody(messageId: string) {
  return {
    sessionId: 'sess_1',
    messageId,
    from: { id: 'visitor_1', name: 'Ana' },
    text: 'hola',
  };
}

describe('POST /webhooks/:channel', () => {
  let app: AppServer;
  let publisher: ReturnType<typeof createFakePublisher>;

  beforeEach(async () => {
    publisher = createFakePublisher();
    app = await buildApp({
      logger,
      metrics: createMetrics('channel-gateway-test'),
      publisher,
      idempotency: createFakeIdempotency(),
      adapters: createAdapters(),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a valid webchat message with 202 and publishes it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/webchat',
      payload: webChatBody('wc_1'),
    });

    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.status).toBe('accepted');
    expect(body.eventId).toBeDefined();
    expect(body.correlationId).toBeDefined();
    expect(publisher.published).toHaveLength(1);
  });

  it('returns 200 + duplicate on the second identical delivery', async () => {
    await app.inject({ method: 'POST', url: '/webhooks/webchat', payload: webChatBody('wc_dup') });
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/webchat',
      payload: webChatBody('wc_dup'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('duplicate');
    expect(publisher.published).toHaveLength(1);
  });

  it('returns 404 for an unknown channel', async () => {
    const res = await app.inject({ method: 'POST', url: '/webhooks/carrier-pigeon', payload: {} });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('unknown_channel');
  });

  it('returns 400 for a malformed payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/webchat',
      payload: { nope: true },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_payload');
    expect(publisher.published).toHaveLength(0);
  });

  it('propagates an incoming correlation id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/webchat',
      headers: { 'x-correlation-id': 'corr_fixed' },
      payload: webChatBody('wc_corr'),
    });
    expect(res.headers['x-correlation-id']).toBe('corr_fixed');
    expect(res.json().correlationId).toBe('corr_fixed');
    expect(publisher.published[0]?.correlationId).toBe('corr_fixed');
  });

  it('accepts a WhatsApp Cloud API webhook', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/whatsapp',
      payload: {
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ profile: { name: 'Ana' }, wa_id: '5491112345678' }],
                  messages: [
                    {
                      from: '5491112345678',
                      id: 'wamid.gateway_unit',
                      type: 'text',
                      text: { body: 'hola wa' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(202);
    expect(publisher.published[0]?.payload).toMatchObject({
      channel: 'whatsapp',
      externalMessageId: 'wamid.gateway_unit',
    });
  });
});

describe('POST /webhooks/:channel with webhook secret', () => {
  let app: AppServer;

  beforeEach(async () => {
    app = await buildApp({
      logger,
      metrics: createMetrics('channel-gateway-test-secret'),
      publisher: createFakePublisher(),
      idempotency: createFakeIdempotency(),
      adapters: createAdapters({ secret: 's3cr3t' }),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects a call without the token (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/webchat',
      payload: webChatBody('wc_1'),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthorized');
  });

  it('accepts a call with the matching token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/webchat',
      headers: { 'x-webhook-token': 's3cr3t' },
      payload: webChatBody('wc_2'),
    });
    expect(res.statusCode).toBe(202);
  });
});
