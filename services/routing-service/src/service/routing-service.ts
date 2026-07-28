import type { IdempotencyStore, Logger, PgClient, PostgresConnection } from '@cx-orbit/platform';
import {
  type AnyEvent,
  type EventEnvelope,
  type EventType,
  createEvent,
  newEventId,
} from '@cx-orbit/shared';
import { decideRoute } from '../domain/engine.js';
import type { IntentRule, RoutingDecision, RoutingInput } from '../domain/types.js';
import type { RoutingMetrics } from '../metrics.js';

const SOURCE = 'routing-service';

export interface RoutingServiceDeps {
  pg: PostgresConnection;
  idempotency: IdempotencyStore;
  metrics: RoutingMetrics;
  logger: Logger;
  minConfidence: number;
  loadRules: () => Promise<IntentRule[]>;
  idempotencyTtlSeconds?: number | undefined;
  notifyOutbox?: () => void;
}

export function createRoutingService(deps: RoutingServiceDeps) {
  const { pg, idempotency, metrics, logger, minConfidence } = deps;

  function makeEvent<T extends EventType>(
    eventType: T,
    payload: EventEnvelope<T>['payload'],
    trace: { correlationId: string; traceId: string },
  ): AnyEvent {
    return createEvent({
      eventType,
      payload,
      source: SOURCE,
      correlationId: trace.correlationId,
      traceId: trace.traceId,
    }) as unknown as AnyEvent;
  }

  async function enqueue(client: PgClient, events: AnyEvent[]): Promise<void> {
    for (const event of events) {
      await client.query('INSERT INTO routing.outbox (id, event) VALUES ($1, $2::jsonb)', [
        event.eventId,
        JSON.stringify(event),
      ]);
    }
  }

  async function persistDecision(
    client: PgClient,
    conversationId: string,
    decision: RoutingDecision,
  ): Promise<string> {
    const id = newEventId().replace(/^evt_/, 'route_');
    await client.query(
      `INSERT INTO routing.decisions
         (id, conversation_id, assigned_team, priority, reason, handoff_to_human, handoff_reason)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        id,
        conversationId,
        decision.assignedTeam,
        decision.priority,
        JSON.stringify(decision.reason),
        decision.handoffToHuman,
        decision.handoffReason ?? null,
      ],
    );
    return id;
  }

  async function route(
    input: RoutingInput,
    trace: { correlationId: string; traceId: string },
  ): Promise<{ status: 'decided' | 'duplicate'; decision?: RoutingDecision }> {
    const key = `routing:${input.conversationId}`;
    const first = await idempotency.markIfFirst(key, deps.idempotencyTtlSeconds);
    if (!first) {
      return { status: 'duplicate' };
    }

    const rules = await deps.loadRules();
    const decision = decideRoute(input, { minConfidence, rules });

    await pg.withTransaction(async (client) => {
      await persistDecision(client, input.conversationId, decision);

      const completed = makeEvent(
        'routing.completed',
        {
          conversationId: input.conversationId,
          assignedTeam: decision.assignedTeam,
          priority: decision.priority,
          reason: decision.reason,
          handoffToHuman: decision.handoffToHuman,
          ...(decision.handoffReason !== undefined
            ? { handoffReason: decision.handoffReason }
            : {}),
        },
        trace,
      );
      const assigned = makeEvent(
        'conversation.assigned',
        {
          conversationId: input.conversationId,
          assignedTeam: decision.assignedTeam,
        },
        trace,
      );
      await enqueue(client, [completed, assigned]);
    });

    metrics.decisions.inc({ handoff: decision.handoffToHuman ? 'true' : 'false' });
    deps.notifyOutbox?.();
    logger.info(
      {
        conversationId: input.conversationId,
        team: decision.assignedTeam,
        priority: decision.priority,
        handoff: decision.handoffToHuman,
        reason: decision.reason,
      },
      'routing decided',
    );
    return { status: 'decided', decision };
  }

  async function handleAiAnalysisCompleted(
    event: EventEnvelope<'ai.analysis.completed'>,
  ): Promise<{ status: 'decided' | 'duplicate'; decision?: RoutingDecision }> {
    return route(
      {
        conversationId: event.payload.conversationId,
        intent: event.payload.intent,
        sentiment: event.payload.sentiment,
        confidence: event.payload.confidence,
      },
      { correlationId: event.correlationId, traceId: event.traceId },
    );
  }

  return { route, handleAiAnalysisCompleted };
}

export type RoutingService = ReturnType<typeof createRoutingService>;
