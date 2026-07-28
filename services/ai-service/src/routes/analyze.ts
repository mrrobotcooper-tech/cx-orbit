import { type AppServer, getRequestContext } from '@cx-orbit/platform';
import { z } from 'zod';
import type { AnalysisService } from '../service/analysis-service.js';

export interface AnalyzeRoutesDeps {
  service: AnalysisService;
}

const bodySchema = z.object({
  text: z.string().min(1),
  conversationId: z.string().min(1),
  messageId: z.string().min(1).optional(),
});

/** Sync analyze endpoint for demos and unit-style HTTP checks. */
export function registerAnalyzeRoutes(app: AppServer, deps: AnalyzeRoutesDeps): void {
  app.post('/analyze', async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return {
        error: { code: 'invalid_body', message: 'Invalid body', issues: parsed.error.issues },
      };
    }
    const ctx = getRequestContext(req);
    const result = await deps.service.analyzeAndPublish(parsed.data, ctx);
    reply.code(result.status === 'duplicate' ? 200 : 202);
    return {
      status: result.status,
      ...(result.eventId !== undefined ? { eventId: result.eventId } : {}),
      ...(result.confidence !== undefined ? { confidence: result.confidence } : {}),
      ...(result.usedFallback !== undefined ? { usedFallback: result.usedFallback } : {}),
      ...(result.bundle
        ? {
            intent: result.bundle.intent.intent,
            sentiment: result.bundle.sentiment.sentiment,
            entities: result.bundle.entities.entities,
            summary: result.bundle.summary.summary,
          }
        : {}),
      correlationId: ctx.correlationId,
    };
  });
}
