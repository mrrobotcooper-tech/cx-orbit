import {
  type ClientSession,
  type Logger,
  type MongoClient,
  isDuplicateKeyError,
} from '@cx-orbit/platform';
import {
  type AnyEvent,
  type CanonicalInboundMessage,
  type ConversationStatus,
  type EventEnvelope,
  type EventType,
  createEvent,
  newConversationId,
  newMessageId,
} from '@cx-orbit/shared';
import type { Collections } from '../db/collections.js';
import type { ConversationDoc, MessageDoc, OutboxDoc } from '../domain/types.js';
import type { ConversationMetrics } from '../metrics.js';

const SOURCE = 'conversation-service';

/** Statuses in which a new inbound message is appended to the existing thread. */
const ACTIVE_STATUSES: ConversationStatus[] = [
  'OPEN',
  'WAITING_CUSTOMER',
  'WAITING_AGENT',
  'WAITING_EXTERNAL_SERVICE',
];

export interface ConversationServiceDeps {
  client: MongoClient;
  collections: Collections;
  metrics: ConversationMetrics;
  logger: Logger;
  /** Nudged after a successful commit so the outbox relay can publish promptly. */
  notifyOutbox?: () => void;
}

interface TraceContext {
  correlationId: string;
  traceId: string;
}

function toOutboxDoc(event: AnyEvent, now: Date): OutboxDoc {
  return { _id: event.eventId, event, status: 'pending', attempts: 0, createdAt: now };
}

export function createConversationService(deps: ConversationServiceDeps) {
  const { client, collections, metrics, logger } = deps;

  function makeEvent<T extends EventType>(
    eventType: T,
    payload: EventEnvelope<T>['payload'],
    trace: TraceContext,
  ): AnyEvent {
    // createEvent returns EventEnvelope<T>; widen to the AnyEvent union for the
    // outbox. Safe: EventEnvelope<T> is by construction a member of AnyEvent.
    return createEvent({
      eventType,
      payload,
      source: SOURCE,
      correlationId: trace.correlationId,
      traceId: trace.traceId,
    }) as unknown as AnyEvent;
  }

  async function findActiveConversation(
    channel: CanonicalInboundMessage['channel'],
    threadKey: string,
    session: ClientSession,
  ): Promise<ConversationDoc | null> {
    return collections.conversations.findOne(
      { channel, threadKey, status: { $in: ACTIVE_STATUSES } },
      { sort: { lastMessageAt: -1 }, session },
    );
  }

  /**
   * Consume `message.received`: idempotently persist the message, create or
   * reopen the conversation, and enqueue outbox events — all in ONE transaction.
   */
  async function handleMessageReceived(
    event: EventEnvelope<'message.received'>,
  ): Promise<{ status: 'processed' | 'duplicate'; conversationId?: string }> {
    const msg = event.payload;
    const trace: TraceContext = {
      correlationId: event.correlationId,
      traceId: event.traceId,
    };

    // Fast idempotency pre-check (authoritative guard is the unique index below).
    const existing = await collections.messages.findOne({
      channel: msg.channel,
      externalMessageId: msg.externalMessageId,
    });
    if (existing) {
      metrics.messagesProcessed.inc({ result: 'duplicate' });
      return { status: 'duplicate', conversationId: existing.conversationId };
    }

    const threadKey = msg.externalConversationId ?? msg.sender.externalId;
    const session = client.startSession();
    let conversationId: string | undefined;

    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const messageId = newMessageId();
        let created = false;

        let conversation = await findActiveConversation(msg.channel, threadKey, session);

        if (!conversation) {
          conversation = buildNewConversation(msg, threadKey, messageId, now);
          await collections.conversations.insertOne(conversation, { session });
          created = true;
        } else {
          await collections.conversations.updateOne(
            { _id: conversation._id },
            {
              $inc: { messageCount: 1 },
              $set: { lastMessageId: messageId, lastMessageAt: now, updatedAt: now },
            },
            { session },
          );
        }
        conversationId = conversation._id;

        const messageDoc = buildMessageDoc(msg, conversation._id, messageId, now);
        await collections.messages.insertOne(messageDoc, { session });

        const outboxDocs: OutboxDoc[] = [];
        if (created) {
          outboxDocs.push(
            toOutboxDoc(
              makeEvent(
                'conversation.created',
                {
                  conversationId: conversation._id,
                  channel: msg.channel,
                  status: conversation.status,
                  ...(msg.externalConversationId !== undefined
                    ? { externalConversationId: msg.externalConversationId }
                    : {}),
                  firstMessageId: messageId,
                },
                trace,
              ),
              now,
            ),
          );
        }
        outboxDocs.push(
          toOutboxDoc(
            makeEvent(
              'conversation.updated',
              {
                conversationId: conversation._id,
                status: conversation.status,
                changes: {
                  lastMessageId: messageId,
                  direction: 'inbound',
                },
              },
              trace,
            ),
            now,
          ),
        );

        await collections.outbox.insertMany(outboxDocs, { session });

        if (created) metrics.conversationsCreated.inc();
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        // Lost the race against a concurrent delivery of the same message.
        metrics.messagesProcessed.inc({ result: 'duplicate' });
        return { status: 'duplicate' };
      }
      throw err;
    } finally {
      await session.endSession();
    }

    metrics.messagesProcessed.inc({ result: 'processed' });
    deps.notifyOutbox?.();
    logger.info({ conversationId, channel: msg.channel }, 'message.received processed');
    return { status: 'processed', ...(conversationId ? { conversationId } : {}) };
  }

  /** Consume `routing.completed`: apply the routing decision to the conversation. */
  async function handleRoutingCompleted(event: EventEnvelope<'routing.completed'>): Promise<void> {
    const p = event.payload;
    const trace: TraceContext = {
      correlationId: event.correlationId,
      traceId: event.traceId,
    };
    const status: ConversationStatus = p.handoffToHuman ? 'WAITING_AGENT' : 'OPEN';
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const res = await collections.conversations.updateOne(
          { _id: p.conversationId },
          {
            $set: {
              assignedTeam: p.assignedTeam,
              priority: p.priority,
              status,
              updatedAt: now,
            },
          },
          { session },
        );
        if (res.matchedCount === 0) {
          logger.warn(
            { conversationId: p.conversationId },
            'routing.completed for unknown conversation',
          );
          return;
        }
        await collections.outbox.insertOne(
          toOutboxDoc(
            makeEvent(
              'conversation.assigned',
              { conversationId: p.conversationId, assignedTeam: p.assignedTeam },
              trace,
            ),
            now,
          ),
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    deps.notifyOutbox?.();
  }

  /** REST action: resolve a conversation and emit `conversation.resolved`. */
  async function resolveConversation(
    conversationId: string,
    resolvedBy: 'bot' | 'agent',
    trace: TraceContext,
  ): Promise<boolean> {
    const session = client.startSession();
    let resolved = false;
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const conversation = await collections.conversations.findOne(
          { _id: conversationId },
          { session },
        );
        if (!conversation) return;

        await collections.conversations.updateOne(
          { _id: conversationId },
          { $set: { status: 'RESOLVED', updatedAt: now } },
          { session },
        );

        const resolutionTimeMs = now.getTime() - conversation.createdAt.getTime();
        await collections.outbox.insertOne(
          toOutboxDoc(
            makeEvent(
              'conversation.resolved',
              { conversationId, resolvedBy, resolutionTimeMs },
              trace,
            ),
            now,
          ),
          { session },
        );
        resolved = true;
      });
    } finally {
      await session.endSession();
    }
    if (resolved) deps.notifyOutbox?.();
    return resolved;
  }

  return { handleMessageReceived, handleRoutingCompleted, resolveConversation };
}

export type ConversationService = ReturnType<typeof createConversationService>;

function buildNewConversation(
  msg: CanonicalInboundMessage,
  threadKey: string,
  firstMessageId: string,
  now: Date,
): ConversationDoc {
  return {
    _id: newConversationId(),
    channel: msg.channel,
    threadKey,
    status: 'OPEN',
    messageCount: 1,
    firstMessageId,
    lastMessageId: firstMessageId,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
    ...(msg.externalConversationId !== undefined
      ? { externalConversationId: msg.externalConversationId }
      : {}),
  };
}

function buildMessageDoc(
  msg: CanonicalInboundMessage,
  conversationId: string,
  messageId: string,
  now: Date,
): MessageDoc {
  return {
    _id: messageId,
    conversationId,
    channel: msg.channel,
    direction: 'inbound',
    externalMessageId: msg.externalMessageId,
    sender: msg.sender,
    content: msg.content,
    createdAt: now,
  };
}
