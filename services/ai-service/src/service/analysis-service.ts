import type { EventBus, IdempotencyStore, Logger } from '@cx-orbit/platform';
import { createEvent, type EventEnvelope } from '@cx-orbit/shared';
import type { AiMetrics } from '../metrics.js';
import {
  AIProviderError,
  AIValidationError,
  type AIProvider,
  type AnalysisBundle,
  type AnalyzeMessageInput,
} from '../providers/types.js';
import { analyzeWithValidation, fallbackAnalysis } from '../providers/validate.js';

const SOURCE = 'ai-service';

export interface AnalysisServiceDeps {
  provider: AIProvider;
  bus: EventBus;
  idempotency: IdempotencyStore;
  metrics: AiMetrics;
  logger: Logger;
  minConfidence: number;
  timeoutMs: number;
  idempotencyTtlSeconds?: number | undefined;
}

export interface AnalysisOutcome {
  status: 'ok' | 'fallback' | 'duplicate' | 'skipped';
  confidence?: number;
  usedFallback?: boolean;
  eventId?: string;
  bundle?: AnalysisBundle;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new AIProviderError('analysis timed out', 'TIMEOUT')),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function createAnalysisService(deps: AnalysisServiceDeps) {
  const { provider, bus, idempotency, metrics, logger, minConfidence, timeoutMs } = deps;

  async function analyzeAndPublish(
    input: AnalyzeMessageInput,
    trace: { correlationId: string; traceId: string },
  ): Promise<AnalysisOutcome> {
    const key = `ai:${input.conversationId}:${input.messageId ?? 'none'}`;
    const first = await idempotency.markIfFirst(key, deps.idempotencyTtlSeconds);
    if (!first) {
      metrics.analyses.inc({ result: 'duplicate' });
      return { status: 'duplicate' };
    }

    let bundle: AnalysisBundle;
    let usedFallback = false;
    let failureReason: string | undefined;

    try {
      bundle = await withTimeout(analyzeWithValidation(provider, input), timeoutMs);
      if (bundle.confidence < minConfidence) {
        // Low confidence is still a valid analysis — emit it; routing will hand off.
        failureReason = 'LOW_CONFIDENCE';
        metrics.failures.inc({ reason: 'LOW_CONFIDENCE' });
      }
    } catch (err) {
      usedFallback = true;
      if (err instanceof AIValidationError) {
        failureReason = 'INVALID_JSON';
        metrics.failures.inc({ reason: 'INVALID_JSON' });
        logger.warn(
          { issues: err.issues, conversationId: input.conversationId },
          'AI output rejected',
        );
      } else if (err instanceof AIProviderError) {
        failureReason = err.code;
        metrics.failures.inc({ reason: err.code });
        logger.warn({ code: err.code, err: err.message }, 'AI provider failed; using fallback');
      } else {
        failureReason = 'PROVIDER_ERROR';
        metrics.failures.inc({ reason: 'PROVIDER_ERROR' });
        logger.error({ err }, 'unexpected AI failure; using fallback');
      }
      bundle = fallbackAnalysis(input);
    }

    const event = createEvent({
      eventType: 'ai.analysis.completed',
      source: SOURCE,
      correlationId: trace.correlationId,
      traceId: trace.traceId,
      payload: {
        conversationId: input.conversationId,
        ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
        intent: bundle.intent.intent,
        sentiment: bundle.sentiment.sentiment,
        confidence: bundle.confidence,
        ...(Object.keys(bundle.entities.entities).length > 0
          ? { entities: bundle.entities.entities }
          : {}),
      },
    });

    await bus.publish(event);
    metrics.eventsPublished.inc({ type: 'ai.analysis.completed' });
    metrics.analyses.inc({ result: usedFallback ? 'fallback' : 'ok' });

    logger.info(
      {
        conversationId: input.conversationId,
        intent: bundle.intent.intent,
        confidence: bundle.confidence,
        usedFallback,
        failureReason,
        belowThreshold: bundle.confidence < minConfidence,
      },
      'analysis completed',
    );

    return {
      status: usedFallback ? 'fallback' : 'ok',
      confidence: bundle.confidence,
      usedFallback,
      eventId: event.eventId,
      bundle,
    };
  }

  /** Handle conversation.updated with inbound text. */
  async function handleConversationUpdated(
    event: EventEnvelope<'conversation.updated'>,
  ): Promise<AnalysisOutcome> {
    const changes = event.payload.changes ?? {};
    const direction = changes.direction;
    const text = changes.text;
    if (direction !== 'inbound' || typeof text !== 'string' || text.trim().length === 0) {
      return { status: 'skipped' };
    }
    const messageId = typeof changes.lastMessageId === 'string' ? changes.lastMessageId : undefined;
    return analyzeAndPublish(
      {
        text,
        conversationId: event.payload.conversationId,
        messageId,
      },
      { correlationId: event.correlationId, traceId: event.traceId },
    );
  }

  return { analyzeAndPublish, handleConversationUpdated };
}

export type AnalysisService = ReturnType<typeof createAnalysisService>;
