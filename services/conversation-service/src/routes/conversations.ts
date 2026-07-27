import { type AppServer, getRequestContext } from '@cx-orbit/platform';
import { ChannelSchema, ConversationStatusSchema } from '@cx-orbit/shared';
import type { Filter } from 'mongodb';
import { z } from 'zod';
import type { Collections } from '../db/collections.js';
import { toConversationDTO, toMessageDTO } from '../domain/mappers.js';
import type { ConversationDoc } from '../domain/types.js';
import type { ConversationService } from '../service/conversation-service.js';

export interface ConversationRoutesDeps {
  collections: Collections;
  service: ConversationService;
  defaultPageSize: number;
  maxPageSize: number;
}

const resolveBodySchema = z.object({
  resolvedBy: z.enum(['bot', 'agent']).default('agent'),
});

export function registerConversationRoutes(app: AppServer, deps: ConversationRoutesDeps): void {
  const listQuerySchema = z.object({
    channel: ChannelSchema.optional(),
    status: ConversationStatusSchema.optional(),
    priority: z.coerce.number().int().min(1).max(10).optional(),
    assignedTeam: z.string().min(1).optional(),
    createdFrom: z.string().datetime({ offset: true }).optional(),
    createdTo: z.string().datetime({ offset: true }).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .max(deps.maxPageSize)
      .default(deps.defaultPageSize),
  });

  // GET /conversations — paginated + filtered list.
  app.get('/conversations', async (req, reply) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return {
        error: {
          code: 'invalid_query',
          message: 'Invalid query parameters',
          issues: parsed.error.issues,
        },
      };
    }
    const q = parsed.data;

    const filter: Filter<ConversationDoc> = {};
    if (q.channel) filter.channel = q.channel;
    if (q.status) filter.status = q.status;
    if (q.priority !== undefined) filter.priority = q.priority;
    if (q.assignedTeam) filter.assignedTeam = q.assignedTeam;
    if (q.createdFrom || q.createdTo) {
      filter.createdAt = {
        ...(q.createdFrom ? { $gte: new Date(q.createdFrom) } : {}),
        ...(q.createdTo ? { $lte: new Date(q.createdTo) } : {}),
      };
    }

    const [docs, total] = await Promise.all([
      deps.collections.conversations
        .find(filter)
        .sort({ lastMessageAt: -1 })
        .skip((q.page - 1) * q.pageSize)
        .limit(q.pageSize)
        .toArray(),
      deps.collections.conversations.countDocuments(filter),
    ]);

    return {
      data: docs.map(toConversationDTO),
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
      },
    };
  });

  // GET /conversations/:id — conversation with its messages.
  app.get<{ Params: { id: string }; Querystring: { messagesLimit?: string } }>(
    '/conversations/:id',
    async (req, reply) => {
      const conversation = await deps.collections.conversations.findOne({ _id: req.params.id });
      if (!conversation) {
        reply.code(404);
        return { error: { code: 'not_found', message: 'Conversation not found' } };
      }
      const messagesLimit = Math.min(Number(req.query.messagesLimit ?? 100) || 100, 500);
      const messages = await deps.collections.messages
        .find({ conversationId: conversation._id })
        .sort({ createdAt: 1 })
        .limit(messagesLimit)
        .toArray();

      return {
        conversation: toConversationDTO(conversation),
        messages: messages.map(toMessageDTO),
      };
    },
  );

  // POST /conversations/:id/resolve — mark resolved, emit conversation.resolved.
  app.post<{ Params: { id: string } }>('/conversations/:id/resolve', async (req, reply) => {
    const parsed = resolveBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return {
        error: { code: 'invalid_body', message: 'Invalid body', issues: parsed.error.issues },
      };
    }
    const ctx = getRequestContext(req);
    const ok = await deps.service.resolveConversation(req.params.id, parsed.data.resolvedBy, ctx);
    if (!ok) {
      reply.code(404);
      return { error: { code: 'not_found', message: 'Conversation not found' } };
    }
    return { status: 'resolved', conversationId: req.params.id };
  });
}
