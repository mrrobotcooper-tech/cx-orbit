import { type AppServer, getRequestContext, type PostgresConnection } from '@cx-orbit/platform';
import { SentimentSchema } from '@cx-orbit/shared';
import { z } from 'zod';
import type { RoutingService } from '../service/routing-service.js';

export interface RouteRoutesDeps {
  service: RoutingService;
  pg: PostgresConnection;
}

const bodySchema = z.object({
  conversationId: z.string().min(1),
  intent: z.string().min(1),
  sentiment: SentimentSchema,
  confidence: z.number().min(0).max(1),
  channel: z.string().min(1).optional(),
});

export function registerRouteRoutes(app: AppServer, deps: RouteRoutesDeps): void {
  app.post('/route', async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return {
        error: { code: 'invalid_body', message: 'Invalid body', issues: parsed.error.issues },
      };
    }
    const ctx = getRequestContext(req);
    const result = await deps.service.route(parsed.data, ctx);
    if (result.status === 'duplicate') {
      reply.code(200);
      return { status: 'duplicate', conversationId: parsed.data.conversationId };
    }
    reply.code(202);
    return {
      status: 'decided',
      conversationId: parsed.data.conversationId,
      decision: result.decision,
      correlationId: ctx.correlationId,
    };
  });

  app.get<{ Params: { conversationId: string } }>(
    '/routing/decisions/:conversationId',
    async (req, reply) => {
      const res = await deps.pg.query<{
        id: string;
        conversation_id: string;
        assigned_team: string;
        priority: number;
        reason: string[];
        handoff_to_human: boolean;
        handoff_reason: string | null;
        created_at: Date;
      }>(
        `SELECT id, conversation_id, assigned_team, priority, reason, handoff_to_human, handoff_reason, created_at
           FROM routing.decisions
          WHERE conversation_id = $1
          ORDER BY created_at DESC
          LIMIT 10`,
        [req.params.conversationId],
      );
      if (res.rows.length === 0) {
        reply.code(404);
        return { error: { code: 'not_found', message: 'No decisions for conversation' } };
      }
      return {
        data: res.rows.map((r) => ({
          id: r.id,
          conversationId: r.conversation_id,
          assignedTeam: r.assigned_team,
          priority: r.priority,
          reason: r.reason,
          handoffToHuman: r.handoff_to_human,
          ...(r.handoff_reason ? { handoffReason: r.handoff_reason } : {}),
          createdAt: r.created_at.toISOString(),
        })),
      };
    },
  );
}
