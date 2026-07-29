import {
  FAULT_KEYS,
  type EventBus,
  type FaultStore,
  type Logger,
} from '@cx-orbit/platform';
import { createEvent, type IncidentType } from '@cx-orbit/shared';
import { randomUUID } from 'node:crypto';
import {
  PHASE10_INCIDENTS,
  resolveIncidentType,
  type IncidentDefinition,
} from './catalog.js';
import type { IncidentMetrics } from './metrics.js';

const SOURCE = 'incident-simulator';

export interface StartIncidentInput {
  type?: string;
  code?: string;
  durationSeconds?: number;
  params?: Record<string, unknown>;
}

export interface ActiveIncident {
  incidentId: string;
  code: string;
  type: IncidentType;
  title: string;
  startedAt: string;
  durationSeconds?: number;
  params: Record<string, unknown>;
  symptoms: string[];
  diagnosis: string[];
  runbook: string;
}

export interface IncidentEngine {
  catalog(): IncidentDefinition[];
  listActive(): ActiveIncident[];
  get(incidentId: string): ActiveIncident | undefined;
  start(input: StartIncidentInput): Promise<ActiveIncident>;
  stop(incidentId: string, reason?: 'completed' | 'manual' | 'error'): Promise<ActiveIncident>;
  stopAll(reason?: 'completed' | 'manual' | 'error'): Promise<ActiveIncident[]>;
}

export interface IncidentEngineDeps {
  bus: EventBus;
  faults: FaultStore;
  metrics: IncidentMetrics;
  logger: Logger;
  defaults: {
    queueBacklogCount: number;
    dbLatencyMs: number;
  };
}

function asPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createIncidentEngine(deps: IncidentEngineDeps): IncidentEngine {
  const { bus, faults, metrics, logger, defaults } = deps;
  const active = new Map<string, ActiveIncident>();
  const timers = new Map<string, NodeJS.Timeout>();

  async function publishStarted(incident: ActiveIncident): Promise<void> {
    await bus.publish(
      createEvent({
        eventType: 'incident.started',
        source: SOURCE,
        payload: {
          incidentId: incident.incidentId,
          type: incident.type,
          ...(incident.durationSeconds !== undefined
            ? { durationSeconds: incident.durationSeconds }
            : {}),
          params: incident.params,
        },
      }),
    );
  }

  async function publishEnded(
    incident: ActiveIncident,
    reason: 'completed' | 'manual' | 'error',
  ): Promise<void> {
    await bus.publish(
      createEvent({
        eventType: 'incident.ended',
        source: SOURCE,
        payload: {
          incidentId: incident.incidentId,
          type: incident.type,
          reason,
        },
      }),
    );
  }

  async function injectDuplicates(params: Record<string, unknown>): Promise<void> {
    const externalMessageId =
      typeof params.externalMessageId === 'string' && params.externalMessageId.length > 0
        ? params.externalMessageId
        : `dup_${randomUUID()}`;
    const rounds = asPositiveInt(params.rounds, 1);
    const senderId =
      typeof params.senderExternalId === 'string' && params.senderExternalId.length > 0
        ? params.senderExternalId
        : `user_inc001_${randomUUID().slice(0, 8)}`;

    for (let r = 0; r < rounds; r += 1) {
      const correlationId = `corr_inc001_${randomUUID()}`;
      for (let copy = 0; copy < 2; copy += 1) {
        await bus.publish(
          createEvent({
            eventType: 'message.received',
            source: SOURCE,
            correlationId,
            payload: {
              channel: 'webchat',
              externalMessageId,
              externalConversationId: `thread_inc001_${senderId}`,
              sender: { externalId: senderId, displayName: 'INC-001 injector' },
              content: { type: 'text', text: 'duplicate injection from incident-simulator' },
              metadata: { incident: 'INC-001', copy, round: r },
            },
          }),
        );
        metrics.injections.inc({ type: 'DUPLICATE_MESSAGES', kind: 'message.received' });
      }
      await sleep(20);
    }
    logger.warn(
      { externalMessageId, rounds },
      'INC-001 injected duplicate message.received events',
    );
  }

  async function injectQueueBacklog(params: Record<string, unknown>): Promise<void> {
    const count = asPositiveInt(params.count, defaults.queueBacklogCount);
    const batchId = randomUUID().slice(0, 8);
    for (let i = 0; i < count; i += 1) {
      await bus.publish(
        createEvent({
          eventType: 'message.received',
          source: SOURCE,
          payload: {
            channel: 'webchat',
            externalMessageId: `backlog_${batchId}_${i}`,
            externalConversationId: `thread_backlog_${batchId}`,
            sender: { externalId: `user_backlog_${batchId}`, displayName: 'INC-003 flood' },
            content: { type: 'text', text: `queue backlog flood #${i}` },
            metadata: { incident: 'INC-003', index: i, batchId },
          },
        }),
      );
      metrics.injections.inc({ type: 'QUEUE_BACKLOG', kind: 'message.received' });
    }
    logger.warn({ count, batchId }, 'INC-003 flooded message.received events');
  }

  async function applyEffects(
    def: IncidentDefinition,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const applied = { ...params };

    switch (def.type) {
      case 'DUPLICATE_MESSAGES':
        await injectDuplicates(params);
        break;
      case 'PROVIDER_TIMEOUT':
        await faults.set(FAULT_KEYS.WEBCHAT_SIMULATE, 'timeout');
        applied.faultKey = FAULT_KEYS.WEBCHAT_SIMULATE;
        applied.faultValue = 'timeout';
        logger.warn('INC-002 set webchat_simulate=timeout');
        break;
      case 'QUEUE_BACKLOG':
        await injectQueueBacklog(params);
        break;
      case 'DATABASE_LATENCY': {
        const latencyMs = asPositiveInt(params.latencyMs, defaults.dbLatencyMs);
        await faults.set(FAULT_KEYS.DB_LATENCY_MS, String(latencyMs));
        applied.latencyMs = latencyMs;
        applied.faultKey = FAULT_KEYS.DB_LATENCY_MS;
        logger.warn({ latencyMs }, 'INC-004 set db_latency_ms');
        break;
      }
      case 'AI_INVALID_RESPONSE':
        await faults.set(FAULT_KEYS.AI_FORCE_FAILURE, 'INVALID_JSON');
        applied.faultKey = FAULT_KEYS.AI_FORCE_FAILURE;
        applied.faultValue = 'INVALID_JSON';
        logger.warn('INC-005 set ai_force_failure=INVALID_JSON');
        break;
      case 'EVENT_LOSS':
        await faults.set(FAULT_KEYS.OUTBOX_DROP, '1');
        applied.faultKey = FAULT_KEYS.OUTBOX_DROP;
        applied.faultValue = '1';
        logger.warn('INC-006 set outbox_drop=1');
        break;
      default:
        throw new Error(`Incident type ${def.type as string} is not implemented in Phase 10`);
    }

    return applied;
  }

  async function clearEffects(type: IncidentType): Promise<void> {
    switch (type) {
      case 'PROVIDER_TIMEOUT':
        await faults.del(FAULT_KEYS.WEBCHAT_SIMULATE);
        break;
      case 'DATABASE_LATENCY':
        await faults.del(FAULT_KEYS.DB_LATENCY_MS);
        break;
      case 'AI_INVALID_RESPONSE':
        await faults.del(FAULT_KEYS.AI_FORCE_FAILURE);
        break;
      case 'EVENT_LOSS':
        await faults.del(FAULT_KEYS.OUTBOX_DROP);
        break;
      default:
        break;
    }
  }

  function scheduleAutoStop(incidentId: string, durationSeconds: number): void {
    const timer = setTimeout(() => {
      void stop(incidentId, 'completed').catch((err: unknown) => {
        logger.error({ err, incidentId }, 'auto-stop failed');
      });
    }, durationSeconds * 1000);
    timers.set(incidentId, timer);
  }

  async function start(input: StartIncidentInput): Promise<ActiveIncident> {
    const def = resolveIncidentType(input);
    if (!def) {
      throw Object.assign(new Error('Unknown incident type or code'), {
        statusCode: 400,
        code: 'UNKNOWN_INCIDENT',
      });
    }

    for (const existing of active.values()) {
      if (existing.type === def.type) {
        throw Object.assign(new Error(`Incident ${def.type} is already active`), {
          statusCode: 409,
          code: 'ALREADY_ACTIVE',
          incidentId: existing.incidentId,
        });
      }
    }

    const params = input.params ?? {};
    const appliedParams = await applyEffects(def, params);
    const incidentId = `inc_${randomUUID()}`;
    const incident: ActiveIncident = {
      incidentId,
      code: def.code,
      type: def.type,
      title: def.title,
      startedAt: new Date().toISOString(),
      params: appliedParams,
      symptoms: [...def.symptoms],
      diagnosis: [...def.diagnosis],
      runbook: def.runbook,
      ...(input.durationSeconds !== undefined
        ? { durationSeconds: input.durationSeconds }
        : {}),
    };

    active.set(incidentId, incident);
    metrics.active.set({ type: def.type, code: def.code }, 1);
    metrics.started.inc({ type: def.type, code: def.code });
    await publishStarted(incident);
    logger.info({ incidentId, type: def.type, code: def.code }, 'incident started');

    if (input.durationSeconds !== undefined && input.durationSeconds > 0) {
      scheduleAutoStop(incidentId, input.durationSeconds);
    }

    return incident;
  }

  async function stop(
    incidentId: string,
    reason: 'completed' | 'manual' | 'error' = 'manual',
  ): Promise<ActiveIncident> {
    const incident = active.get(incidentId);
    if (!incident) {
      throw Object.assign(new Error(`Incident ${incidentId} not found`), {
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    const timer = timers.get(incidentId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(incidentId);
    }

    await clearEffects(incident.type);
    active.delete(incidentId);
    metrics.active.set({ type: incident.type, code: incident.code }, 0);
    metrics.ended.inc({ type: incident.type, code: incident.code, reason });
    await publishEnded(incident, reason);
    logger.info({ incidentId, type: incident.type, reason }, 'incident ended');
    return incident;
  }

  async function stopAll(
    reason: 'completed' | 'manual' | 'error' = 'manual',
  ): Promise<ActiveIncident[]> {
    const ids = [...active.keys()];
    const stopped: ActiveIncident[] = [];
    for (const id of ids) {
      stopped.push(await stop(id, reason));
    }
    return stopped;
  }

  return {
    catalog: () => [...PHASE10_INCIDENTS],
    listActive: () => [...active.values()],
    get: (incidentId) => active.get(incidentId),
    start,
    stop,
    stopAll,
  };
}
