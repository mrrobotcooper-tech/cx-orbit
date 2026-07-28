import {
  AIValidationError,
  EntityResultSchema,
  IntentResultSchema,
  SentimentResultSchema,
  SummaryResultSchema,
  type AIProvider,
  type AnalysisBundle,
  type AnalyzeMessageInput,
} from './types.js';

/**
 * Run the four provider calls and validate every result with Zod. Any invalid
 * shape becomes an AIValidationError — callers must treat that as a safe
 * failure and take the fallback path (ADR-008), never crash.
 */
export async function analyzeWithValidation(
  provider: AIProvider,
  input: AnalyzeMessageInput,
): Promise<AnalysisBundle> {
  const [intentRaw, sentimentRaw, entitiesRaw, summaryRaw] = await Promise.all([
    provider.classifyIntent(input.text),
    provider.analyzeSentiment(input.text),
    provider.extractEntities(input.text),
    provider.summarizeConversation([input.text]),
  ]);

  const intent = IntentResultSchema.safeParse(intentRaw);
  const sentiment = SentimentResultSchema.safeParse(sentimentRaw);
  const entities = EntityResultSchema.safeParse(entitiesRaw);
  const summary = SummaryResultSchema.safeParse(summaryRaw);

  const issues: Record<string, unknown> = {};
  if (!intent.success) issues.intent = intent.error.issues;
  if (!sentiment.success) issues.sentiment = sentiment.error.issues;
  if (!entities.success) issues.entities = entities.error.issues;
  if (!summary.success) issues.summary = summary.error.issues;

  if (Object.keys(issues).length > 0) {
    throw new AIValidationError('Provider output failed schema validation', issues);
  }

  // All four succeeded — narrow for TypeScript.
  const i = intent.data!;
  const s = sentiment.data!;
  const e = entities.data!;
  const u = summary.data!;
  const confidence = Math.min(i.confidence, s.confidence, e.confidence, u.confidence);

  return { intent: i, sentiment: s, entities: e, summary: u, confidence };
}

/** Fallback used when the provider fails or returns invalid output. */
export function fallbackAnalysis(input: AnalyzeMessageInput): AnalysisBundle {
  return {
    intent: { intent: 'unknown', confidence: 0 },
    sentiment: { sentiment: 'neutral', confidence: 0 },
    entities: { entities: {}, confidence: 0 },
    summary: {
      summary: `Analysis unavailable for conversation ${input.conversationId}`,
      confidence: 0,
    },
    confidence: 0,
  };
}
