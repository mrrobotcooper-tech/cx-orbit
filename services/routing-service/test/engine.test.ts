import { describe, expect, it } from 'vitest';
import { decideRoute } from '../src/domain/engine.js';

describe('decideRoute (pure engine)', () => {
  it('routes billing + negative sentiment to billing with elevated priority', () => {
    const d = decideRoute(
      {
        conversationId: 'conv_1',
        intent: 'billing',
        sentiment: 'negative',
        confidence: 0.91,
        channel: 'webchat',
      },
      { minConfidence: 0.7 },
    );
    expect(d.assignedTeam).toBe('billing');
    expect(d.handoffToHuman).toBe(false);
    expect(d.priority).toBeGreaterThanOrEqual(6);
    expect(d.reason.some((r) => r.includes('intent:billing'))).toBe(true);
    expect(d.reason.some((r) => r.includes('sentiment:negative'))).toBe(true);
  });

  it('routes cancellation to retention', () => {
    const d = decideRoute({
      conversationId: 'c',
      intent: 'cancellation',
      sentiment: 'neutral',
      confidence: 0.87,
    });
    expect(d.assignedTeam).toBe('retention');
    expect(d.handoffToHuman).toBe(false);
  });

  it('hands off to human when confidence is below threshold', () => {
    const d = decideRoute(
      {
        conversationId: 'c',
        intent: 'billing',
        sentiment: 'negative',
        confidence: 0.2,
      },
      { minConfidence: 0.7 },
    );
    expect(d.handoffToHuman).toBe(true);
    expect(d.handoffReason).toBe('LOW_AI_CONFIDENCE');
    expect(d.reason).toContain('handoff:LOW_AI_CONFIDENCE');
    expect(d.assignedTeam).toBe('billing');
  });

  it('hands off unknown/zero-confidence AI fallback', () => {
    const d = decideRoute(
      {
        conversationId: 'c',
        intent: 'unknown',
        sentiment: 'neutral',
        confidence: 0,
      },
      { minConfidence: 0.7 },
    );
    expect(d.handoffToHuman).toBe(true);
    expect(d.handoffReason).toBe('LOW_AI_CONFIDENCE');
  });

  it('lowers priority for email channel', () => {
    const base = decideRoute({
      conversationId: 'c',
      intent: 'support',
      sentiment: 'neutral',
      confidence: 0.85,
      channel: 'webchat',
    });
    const email = decideRoute({
      conversationId: 'c',
      intent: 'support',
      sentiment: 'neutral',
      confidence: 0.85,
      channel: 'email',
    });
    expect(email.priority).toBeLessThan(base.priority);
  });

  it('applies customer priority boost', () => {
    const d = decideRoute({
      conversationId: 'c',
      intent: 'greeting',
      sentiment: 'positive',
      confidence: 0.95,
      customerPriorityBoost: 3,
    });
    expect(d.reason.some((r) => r.includes('customer:priorityBoost+3'))).toBe(true);
    expect(d.priority).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic for the same input', () => {
    const input = {
      conversationId: 'c',
      intent: 'refund' as const,
      sentiment: 'negative' as const,
      confidence: 0.88,
      channel: 'whatsapp',
    };
    expect(decideRoute(input)).toEqual(decideRoute(input));
  });
});
