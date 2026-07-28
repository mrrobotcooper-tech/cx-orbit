import { SentimentSchema } from '@cx-orbit/shared';
import { z } from 'zod';
import type { AiFailureMode } from '../config.js';

/** Zod schemas for every provider result. Invalid output is rejected (ADR-008). */
export const IntentResultSchema = z.object({
  intent: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type IntentResult = z.infer<typeof IntentResultSchema>;

export const SentimentResultSchema = z.object({
  sentiment: SentimentSchema,
  confidence: z.number().min(0).max(1),
});
export type SentimentResult = z.infer<typeof SentimentResultSchema>;

export const EntityResultSchema = z.object({
  entities: z.record(z.string(), z.string()),
  confidence: z.number().min(0).max(1),
});
export type EntityResult = z.infer<typeof EntityResultSchema>;

export const SummaryResultSchema = z.object({
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type SummaryResult = z.infer<typeof SummaryResultSchema>;

export interface AnalyzeMessageInput {
  text: string;
  conversationId: string;
  messageId?: string | undefined;
}

export interface AnalysisBundle {
  intent: IntentResult;
  sentiment: SentimentResult;
  entities: EntityResult;
  summary: SummaryResult;
  /** Combined confidence used for handoff decisions (min of component confidences). */
  confidence: number;
}

export interface AIProvider {
  readonly name: string;
  classifyIntent(input: string): Promise<IntentResult>;
  analyzeSentiment(input: string): Promise<SentimentResult>;
  extractEntities(input: string): Promise<EntityResult>;
  summarizeConversation(messages: string[]): Promise<SummaryResult>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly code: Exclude<AiFailureMode, 'NONE' | 'LOW_CONFIDENCE' | 'HALLUCINATION'>,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class AIValidationError extends Error {
  constructor(
    message: string,
    readonly issues: unknown,
  ) {
    super(message);
    this.name = 'AIValidationError';
  }
}
