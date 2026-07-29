import { type AppServer, type Logger, type Metrics, createServer } from '@cx-orbit/platform';
import { z } from 'zod';
import type { IncidentEngine } from './engine.js';

export interface BuildAppDeps {
  logger: Logger;
  metrics: Metrics;
  engine: IncidentEngine;
  readiness?: (() => Promise<boolean> | boolean) | undefined;
}

const StartBodySchema = z.object({
  type: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  durationSeconds: z.number().int().positive().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

function errorStatus(err: unknown): { statusCode: number; body: Record<string, unknown> } {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const e = err as { statusCode: number; message: string; code?: string; incidentId?: string };
    return {
      statusCode: e.statusCode,
      body: {
        error: e.code ?? 'ERROR',
        message: e.message,
        ...(e.incidentId !== undefined ? { incidentId: e.incidentId } : {}),
      },
    };
  }
  return {
    statusCode: 500,
    body: {
      error: 'INTERNAL',
      message: err instanceof Error ? err.message : 'unknown error',
    },
  };
}

export async function buildApp(deps: BuildAppDeps): Promise<AppServer> {
  const app = await createServer({
    logger: deps.logger,
    metrics: deps.metrics,
    readiness: deps.readiness,
  });

  app.get('/incidents', async () => ({
    catalog: deps.engine.catalog(),
    active: deps.engine.listActive(),
  }));

  app.get<{ Params: { id: string } }>('/incidents/:id', async (req, reply) => {
    const incident = deps.engine.get(req.params.id);
    if (!incident) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Incident not found' });
    }
    return incident;
  });

  app.post('/incidents/start', async (req, reply) => {
    const parsed = StartBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'VALIDATION',
        message: 'Invalid body',
        issues: parsed.error.issues,
      });
    }
    if (!parsed.data.type && !parsed.data.code) {
      return reply.code(400).send({
        error: 'VALIDATION',
        message: 'Provide type (e.g. DUPLICATE_MESSAGES) or code (e.g. INC-001)',
      });
    }
    try {
      const incident = await deps.engine.start({
        ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
        ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
        ...(parsed.data.durationSeconds !== undefined
          ? { durationSeconds: parsed.data.durationSeconds }
          : {}),
        ...(parsed.data.params !== undefined ? { params: parsed.data.params } : {}),
      });
      return reply.code(201).send(incident);
    } catch (err) {
      const { statusCode, body } = errorStatus(err);
      return reply.code(statusCode).send(body);
    }
  });

  app.post<{ Params: { id: string } }>('/incidents/:id/stop', async (req, reply) => {
    try {
      const incident = await deps.engine.stop(req.params.id, 'manual');
      return { stopped: true, incident };
    } catch (err) {
      const { statusCode, body } = errorStatus(err);
      return reply.code(statusCode).send(body);
    }
  });

  app.post('/incidents/stop-all', async (_req, reply) => {
    try {
      const stopped = await deps.engine.stopAll('manual');
      return { stopped: stopped.length, incidents: stopped };
    } catch (err) {
      const { statusCode, body } = errorStatus(err);
      return reply.code(statusCode).send(body);
    }
  });

  return app;
}
