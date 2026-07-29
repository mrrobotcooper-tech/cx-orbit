import { describe, expect, it } from 'vitest';
import { createMockAIProvider } from '../src/providers/mock.js';
import { analyzeWithValidation, fallbackAnalysis } from '../src/providers/validate.js';

/**
 * Phase 12 failure suite — invalid AI output must never crash the analysis path.
 */
describe('failure: AI invalid response (INC-005)', () => {
  it('INVALID_JSON is rejected by Zod and fallback stays schema-safe', async () => {
    const provider = createMockAIProvider({ forceFailure: 'INVALID_JSON' });
    await expect(
      analyzeWithValidation(provider, { text: 'hola', conversationId: 'conv_fail' }),
    ).rejects.toThrow();

    const fb = fallbackAnalysis({ text: 'hola', conversationId: 'conv_fail' });
    expect(fb.intent).toBeTruthy();
    expect(fb.confidence).toBeGreaterThanOrEqual(0);
    expect(fb.confidence).toBeLessThanOrEqual(1);
  });
});
