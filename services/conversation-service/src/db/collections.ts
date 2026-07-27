import type { Collection, Db } from '@cx-orbit/platform';
import type { ConversationDoc, DeadLetterRecord, MessageDoc, OutboxDoc } from '../domain/types.js';

export interface Collections {
  conversations: Collection<ConversationDoc>;
  messages: Collection<MessageDoc>;
  outbox: Collection<OutboxDoc>;
  deadLetters: Collection<DeadLetterRecord>;
}

export function getCollections(db: Db): Collections {
  return {
    conversations: db.collection<ConversationDoc>('conversations'),
    messages: db.collection<MessageDoc>('messages'),
    outbox: db.collection<OutboxDoc>('conversation_outbox'),
    deadLetters: db.collection<DeadLetterRecord>('conversation_dead_letters'),
  };
}

/**
 * Create the indexes this service relies on. The unique index on
 * (channel, externalMessageId) is the AUTHORITATIVE dedupe guard (ADR-004);
 * the Redis check in the gateway is only the fast first line of defense.
 */
export async function ensureIndexes(collections: Collections): Promise<void> {
  await collections.messages.createIndex(
    { channel: 1, externalMessageId: 1 },
    { unique: true, partialFilterExpression: { externalMessageId: { $exists: true } } },
  );
  await collections.messages.createIndex({ conversationId: 1, createdAt: 1 });

  await collections.conversations.createIndex({ channel: 1, threadKey: 1, status: 1 });
  await collections.conversations.createIndex({ status: 1, lastMessageAt: -1 });
  await collections.conversations.createIndex({ assignedTeam: 1, lastMessageAt: -1 });
  await collections.conversations.createIndex({ createdAt: -1 });

  await collections.outbox.createIndex({ status: 1, createdAt: 1 });
  await collections.deadLetters.createIndex({ createdAt: -1 });
}
