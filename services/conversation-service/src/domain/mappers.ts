import type { ConversationDoc, MessageDoc } from './types.js';

export interface ConversationDTO {
  id: string;
  channel: string;
  externalConversationId?: string;
  customerId?: string;
  status: string;
  priority?: number;
  assignedTeam?: string;
  assignedAgentId?: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  channel: string;
  direction: string;
  sender: MessageDoc['sender'];
  content: MessageDoc['content'];
  createdAt: string;
}

export function toConversationDTO(doc: ConversationDoc): ConversationDTO {
  return {
    id: doc._id,
    channel: doc.channel,
    ...(doc.externalConversationId !== undefined
      ? { externalConversationId: doc.externalConversationId }
      : {}),
    ...(doc.customerId !== undefined ? { customerId: doc.customerId } : {}),
    status: doc.status,
    ...(doc.priority !== undefined ? { priority: doc.priority } : {}),
    ...(doc.assignedTeam !== undefined ? { assignedTeam: doc.assignedTeam } : {}),
    ...(doc.assignedAgentId !== undefined ? { assignedAgentId: doc.assignedAgentId } : {}),
    messageCount: doc.messageCount,
    lastMessageAt: doc.lastMessageAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toMessageDTO(doc: MessageDoc): MessageDTO {
  return {
    id: doc._id,
    conversationId: doc.conversationId,
    channel: doc.channel,
    direction: doc.direction,
    sender: doc.sender,
    content: doc.content,
    createdAt: doc.createdAt.toISOString(),
  };
}
