import type {
  AnyEvent,
  Channel,
  ConversationStatus,
  MessageContent,
  Sender,
} from '@cx-orbit/shared';

export type MessageDirection = 'inbound' | 'outbound';

/** Conversation aggregate — the system of record (owned by this service). */
export interface ConversationDoc {
  _id: string;
  channel: Channel;
  externalConversationId?: string;
  /** Threading key: externalConversationId when present, else sender.externalId. */
  threadKey: string;
  customerId?: string;
  status: ConversationStatus;
  priority?: number;
  assignedTeam?: string;
  assignedAgentId?: string;
  messageCount: number;
  firstMessageId?: string;
  lastMessageId?: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** A single message within a conversation. */
export interface MessageDoc {
  _id: string;
  conversationId: string;
  channel: Channel;
  direction: MessageDirection;
  /** Present only for inbound messages; unique per channel (ADR-004). */
  externalMessageId?: string;
  sender: Sender;
  content: MessageContent;
  createdAt: Date;
}

export type OutboxStatus = 'pending' | 'published';

/**
 * Transactional Outbox record. Written in the SAME transaction as the domain
 * change; a relay publishes it to NATS afterwards (ADR-005).
 */
export interface OutboxDoc {
  _id: string;
  event: AnyEvent;
  status: OutboxStatus;
  attempts: number;
  createdAt: Date;
  publishedAt?: Date;
}

/** A terminally-failed inbound event, kept for inspection/replay (ADR-006). */
export interface DeadLetterRecord {
  reason: string;
  error: string;
  raw: unknown;
  subject: string;
  deliveryCount: number;
  createdAt: Date;
}
