import { describe, expect, it } from 'vitest';
import { toConversationDTO, toMessageDTO } from '../src/domain/mappers.js';
import type { ConversationDoc, MessageDoc } from '../src/domain/types.js';

const now = new Date('2026-01-01T00:00:00.000Z');

describe('toConversationDTO', () => {
  it('serializes dates and omits absent optionals', () => {
    const doc: ConversationDoc = {
      _id: 'conv_1',
      channel: 'webchat',
      threadKey: 'sess_1',
      status: 'OPEN',
      messageCount: 3,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const dto = toConversationDTO(doc);
    expect(dto).toEqual({
      id: 'conv_1',
      channel: 'webchat',
      status: 'OPEN',
      messageCount: 3,
      lastMessageAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    expect('assignedTeam' in dto).toBe(false);
    expect('priority' in dto).toBe(false);
  });

  it('includes optionals when present', () => {
    const doc: ConversationDoc = {
      _id: 'conv_2',
      channel: 'whatsapp',
      threadKey: '549111',
      externalConversationId: '549111',
      customerId: 'customer_1',
      status: 'WAITING_AGENT',
      priority: 5,
      assignedTeam: 'billing',
      assignedAgentId: 'agent_9',
      messageCount: 1,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const dto = toConversationDTO(doc);
    expect(dto.externalConversationId).toBe('549111');
    expect(dto.assignedTeam).toBe('billing');
    expect(dto.priority).toBe(5);
  });
});

describe('toMessageDTO', () => {
  it('maps a message document', () => {
    const doc: MessageDoc = {
      _id: 'msg_1',
      conversationId: 'conv_1',
      channel: 'webchat',
      direction: 'inbound',
      externalMessageId: 'wc_1',
      sender: { externalId: 'visitor_1', displayName: 'Ana' },
      content: { type: 'text', text: 'hola' },
      createdAt: now,
    };
    expect(toMessageDTO(doc)).toEqual({
      id: 'msg_1',
      conversationId: 'conv_1',
      channel: 'webchat',
      direction: 'inbound',
      sender: { externalId: 'visitor_1', displayName: 'Ana' },
      content: { type: 'text', text: 'hola' },
      createdAt: now.toISOString(),
    });
  });
});
