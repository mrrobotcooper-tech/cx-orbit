import { describe, expect, it } from 'vitest';
import { createMockAIProvider } from '../src/providers/mock.js';
import { AIProviderError } from '../src/providers/types.js';
import { analyzeWithValidation, fallbackAnalysis } from '../src/providers/validate.js';

describe('MockAIProvider (happy path)', () => {
  const provider = createMockAIProvider();

  it('classifies billing intent from keywords', async () => {
    const result = await provider.classifyIntent('Tengo un problema con mi factura');
    expect(result.intent).toBe('billing');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('detects negative sentiment', async () => {
    const result = await provider.analyzeSentiment('Este servicio es terrible');
    expect(result.sentiment).toBe('negative');
  });

  it('extracts order ids', async () => {
    const result = await provider.extractEntities('Mi pedido es ORD-42');
    expect(result.entities.orderId).toBe('ORD-42');
  });
});

describe('MockAIProvider failure modes', () => {
  it('TIMEOUT throws AIProviderError', async () => {
    const provider = createMockAIProvider({ forceFailure: 'TIMEOUT', timeoutDelayMs: 5 });
    await expect(provider.classifyIntent('hola')).rejects.toMatchObject({
      name: 'AIProviderError',
      code: 'TIMEOUT',
    });
  });

  it('RATE_LIMIT throws AIProviderError', async () => {
    const provider = createMockAIProvider({ forceFailure: 'RATE_LIMIT' });
    await expect(provider.analyzeSentiment('hola')).rejects.toBeInstanceOf(AIProviderError);
  });

  it('PROVIDER_ERROR throws AIProviderError', async () => {
    const provider = createMockAIProvider({ forceFailure: 'PROVIDER_ERROR' });
    await expect(provider.extractEntities('hola')).rejects.toBeInstanceOf(AIProviderError);
  });

  it('LOW_CONFIDENCE returns schema-valid low scores', async () => {
    const provider = createMockAIProvider({ forceFailure: 'LOW_CONFIDENCE' });
    const intent = await provider.classifyIntent('hola mundo');
    expect(intent.confidence).toBeLessThan(0.5);
  });

  it('HALLUCINATION returns invented but schema-valid intent', async () => {
    const provider = createMockAIProvider({ forceFailure: 'HALLUCINATION' });
    const intent = await provider.classifyIntent('hola');
    expect(intent.intent).toBe('quantum_flux_recalibration');
  });

  it('INVALID_JSON returns shapes that fail Zod validation', async () => {
    const provider = createMockAIProvider({ forceFailure: 'INVALID_JSON' });
    await expect(
      analyzeWithValidation(provider, {
        text: 'hola',
        conversationId: 'conv_1',
        messageId: 'msg_1',
      }),
    ).rejects.toMatchObject({ name: 'AIValidationError' });
  });
});

describe('fallbackAnalysis', () => {
  it('returns zero-confidence unknown intent', () => {
    const fb = fallbackAnalysis({ text: 'x', conversationId: 'conv_1' });
    expect(fb.intent.intent).toBe('unknown');
    expect(fb.confidence).toBe(0);
  });
});
