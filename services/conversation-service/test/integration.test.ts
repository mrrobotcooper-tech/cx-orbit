import {
  type EventBus,
  type MongoConnection,
  connectEventBus,
  connectMongo,
  createLogger,
  Registry,
} from '@cx-orbit/platform';
import { createEvent, type EventEnvelope } from '@cx-orbit/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Collections, ensureIndexes, getCollections } from '../src/db/collections.js';
import { createConversationMetrics } from '../src/metrics.js';
import { createOutboxRelay } from '../src/outbox/relay.js';
import { createConversationService } from '../src/service/conversation-service.js';

/**
 * Integration tests against LIVE infra (Mongo replica set + NATS). Opt-in:
 *   RUN_INTEGRATION=1 pnpm --filter @cx-orbit/conversation-service test
 * They use a throwaway database and clean up after themselves.
 */
const RUN = process.env.RUN_INTEGRATION === '1';
const suite = RUN ? describe : describe.skip;

const MONGO_URI =
  process.env.MONGO_URI ?? 'mongodb://localhost:27017/cxorbit?directConnection=true';
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';
const DB_NAME = 'cxorbit_it';
const logger = createLogger({ service: 'conversation-it', level: 'silent' });

function messageReceived(externalMessageId: string): EventEnvelope<'message.received'> {
  return createEvent({
    eventType: 'message.received',
    source: 'integration-test',
    payload: {
      channel: 'webchat',
      externalMessageId,
      externalConversationId: 'sess_it',
      sender: { externalId: 'visitor_it', displayName: 'Ana' },
      content: { type: 'text', text: 'hola' },
    },
  });
}

suite('conversation-service integration', () => {
  let mongo: MongoConnection;
  let bus: EventBus;
  let collections: Collections;

  beforeAll(async () => {
    mongo = await connectMongo({ uri: MONGO_URI, dbName: DB_NAME });
    bus = await connectEventBus({ url: NATS_URL, streamName: 'CXORBIT' });
    collections = getCollections(mongo.db);
    await ensureIndexes(collections);
    await Promise.all([
      collections.conversations.deleteMany({}),
      collections.messages.deleteMany({}),
      collections.outbox.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongo.db.dropDatabase();
    await bus.close();
    await mongo.close();
  });

  function newService() {
    return createConversationService({
      client: mongo.client,
      collections,
      metrics: createConversationMetrics(new Registry()),
      logger,
    });
  }

  it('persists conversation + message + outbox atomically', async () => {
    const service = newService();
    const id = `wc_${Date.now()}_a`;

    const result = await service.handleMessageReceived(messageReceived(id));
    expect(result.status).toBe('processed');

    const conv = await collections.conversations.findOne({ _id: result.conversationId! });
    expect(conv?.messageCount).toBe(1);

    const msg = await collections.messages.findOne({ channel: 'webchat', externalMessageId: id });
    expect(msg?.conversationId).toBe(result.conversationId);

    const outbox = await collections.outbox.find({ status: 'pending' }).toArray();
    const types = outbox.map((o) => o.event.eventType).sort();
    expect(types).toContain('conversation.created');
    expect(types).toContain('conversation.updated');
  });

  it('is idempotent for duplicate deliveries', async () => {
    const service = newService();
    const id = `wc_${Date.now()}_b`;

    const first = await service.handleMessageReceived(messageReceived(id));
    const second = await service.handleMessageReceived(messageReceived(id));

    expect(first.status).toBe('processed');
    expect(second.status).toBe('duplicate');

    const count = await collections.messages.countDocuments({
      channel: 'webchat',
      externalMessageId: id,
    });
    expect(count).toBe(1);
  });

  it('does not lose events across a relay restart (crash simulation)', async () => {
    const service = newService();
    const id = `wc_${Date.now()}_c`;
    // Write the domain change + outbox, but never pump: simulates a crash right
    // after commit, before publication.
    await service.handleMessageReceived(messageReceived(id));

    const pendingBefore = await collections.outbox.countDocuments({ status: 'pending' });
    expect(pendingBefore).toBeGreaterThan(0);

    // A brand-new relay (as if the process restarted) drains the backlog.
    const relay = createOutboxRelay(
      bus,
      collections,
      createConversationMetrics(new Registry()),
      logger,
    );
    const publishedCount = await relay.pump();
    await relay.stop();

    expect(publishedCount).toBe(pendingBefore);
    const pendingAfter = await collections.outbox.countDocuments({ status: 'pending' });
    expect(pendingAfter).toBe(0);
  });
});
