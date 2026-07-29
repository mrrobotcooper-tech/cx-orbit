import type { AiFailureMode } from '../config.js';
import {
  AIProviderError,
  type AIProvider,
  type EntityResult,
  type IntentResult,
  type SentimentResult,
  type SummaryResult,
} from './types.js';

export interface MockAIProviderOptions {
  /** Injected failure mode (from env or tests). */
  forceFailure?: AiFailureMode;
  /**
   * Dynamic failure mode resolver (Redis fault flags from Incident Simulator).
   * Wins over `forceFailure` when it returns a non-NONE value.
   */
  getForceFailure?: () => Promise<AiFailureMode> | AiFailureMode;
  /** Artificial delay for TIMEOUT simulation, in ms. Default 50. */
  timeoutDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deterministic, offline mock (ADR-008). Keyword heuristics for intent/sentiment;
 * failure modes are injectable for incident simulation and unit tests.
 */
export function createMockAIProvider(options: MockAIProviderOptions = {}): AIProvider {
  const timeoutDelayMs = options.timeoutDelayMs ?? 50;

  async function resolveForce(): Promise<AiFailureMode> {
    if (options.getForceFailure) {
      const dynamic = await options.getForceFailure();
      if (dynamic !== 'NONE') return dynamic;
    }
    return options.forceFailure ?? 'NONE';
  }

  async function maybeFail(stage: string, force: AiFailureMode): Promise<void> {
    switch (force) {
      case 'TIMEOUT':
        await sleep(timeoutDelayMs);
        throw new AIProviderError(`mock timeout at ${stage}`, 'TIMEOUT');
      case 'RATE_LIMIT':
        throw new AIProviderError(`mock rate limited at ${stage}`, 'RATE_LIMIT');
      case 'PROVIDER_ERROR':
        throw new AIProviderError(`mock provider error at ${stage}`, 'PROVIDER_ERROR');
      default:
        break;
    }
  }

  return {
    name: 'mock',

    async classifyIntent(input: string): Promise<IntentResult> {
      const force = await resolveForce();
      await maybeFail('classifyIntent', force);
      if (force === 'INVALID_JSON') {
        return { intent: '', confidence: 2 } as unknown as IntentResult;
      }
      const text = input.toLowerCase();
      let intent = 'general_inquiry';
      let confidence = 0.82;
      if (/\b(factura|billing|invoice|cobro|pago)\b/.test(text)) {
        intent = 'billing';
        confidence = 0.91;
      } else if (/\b(reembolso|refund|devolver)\b/.test(text)) {
        intent = 'refund';
        confidence = 0.88;
      } else if (/\b(cancel|baja|cancelar)\b/.test(text)) {
        intent = 'cancellation';
        confidence = 0.87;
      } else if (/\b(hola|hello|hi|buen[oa]s)\b/.test(text)) {
        intent = 'greeting';
        confidence = 0.95;
      } else if (/\b(ayuda|help|soporte|support)\b/.test(text)) {
        intent = 'support';
        confidence = 0.84;
      }
      if (force === 'LOW_CONFIDENCE') confidence = 0.35;
      if (force === 'HALLUCINATION') {
        // Plausible-looking but invented intent — still schema-valid.
        intent = 'quantum_flux_recalibration';
        confidence = 0.99;
      }
      return { intent, confidence };
    },

    async analyzeSentiment(input: string): Promise<SentimentResult> {
      const force = await resolveForce();
      await maybeFail('analyzeSentiment', force);
      if (force === 'INVALID_JSON') {
        return { sentiment: 'angry', confidence: -1 } as unknown as SentimentResult;
      }
      const text = input.toLowerCase();
      let sentiment: SentimentResult['sentiment'] = 'neutral';
      let confidence = 0.8;
      if (/\b(gracias|perfecto|excelente|genial|thanks)\b/.test(text)) {
        sentiment = 'positive';
        confidence = 0.9;
      } else if (/\b(malo|terrible|enojado|hate|pésimo|estafa)\b/.test(text)) {
        sentiment = 'negative';
        confidence = 0.92;
      }
      if (force === 'LOW_CONFIDENCE') confidence = 0.3;
      return { sentiment, confidence };
    },

    async extractEntities(input: string): Promise<EntityResult> {
      const force = await resolveForce();
      await maybeFail('extractEntities', force);
      if (force === 'INVALID_JSON') {
        return { entities: 'not-an-object', confidence: 1 } as unknown as EntityResult;
      }
      const entities: Record<string, string> = {};
      const order = input.match(/\b(ORD-\d+)\b/i);
      if (order?.[1]) entities.orderId = order[1].toUpperCase();
      const email = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (email?.[0]) entities.email = email[0].toLowerCase();
      if (force === 'HALLUCINATION') entities.ssn = '000-00-0000';
      if (force === 'LOW_CONFIDENCE') return { entities, confidence: 0.25 };
      return { entities, confidence: Object.keys(entities).length > 0 ? 0.85 : 0.7 };
    },

    async summarizeConversation(messages: string[]): Promise<SummaryResult> {
      const force = await resolveForce();
      await maybeFail('summarizeConversation', force);
      if (force === 'INVALID_JSON') {
        return { summary: '', confidence: 5 } as unknown as SummaryResult;
      }
      const joined = messages.join(' ').trim();
      const summary =
        joined.length === 0
          ? 'Empty conversation'
          : joined.length <= 120
            ? joined
            : `${joined.slice(0, 117)}...`;
      return {
        summary,
        confidence: force === 'LOW_CONFIDENCE' ? 0.2 : 0.8,
      };
    },
  };
}
