import type { AiEnv } from '../config.js';
import { createMockAIProvider } from './mock.js';
import type { AIProvider } from './types.js';

/**
 * Select the AI provider from config. Phase 6 only implements `mock`; other
 * values fail fast so we never silently hit a missing API key (ADR-008).
 */
export function createAIProvider(
  config: Pick<AiEnv, 'AI_PROVIDER' | 'AI_FORCE_FAILURE'>,
): AIProvider {
  switch (config.AI_PROVIDER) {
    case 'mock':
      return createMockAIProvider({
        forceFailure: config.AI_FORCE_FAILURE,
      });
    case 'openai':
    case 'anthropic':
    case 'local':
      throw new Error(
        `AI_PROVIDER=${config.AI_PROVIDER} is not implemented yet; use AI_PROVIDER=mock`,
      );
    default: {
      const _exhaustive: never = config.AI_PROVIDER;
      throw new Error(`Unknown AI_PROVIDER: ${_exhaustive}`);
    }
  }
}
