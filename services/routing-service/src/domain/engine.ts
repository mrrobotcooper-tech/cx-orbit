import type { IntentRule, RoutingDecision, RoutingInput } from './types.js';

/** Default intent → team map. Seeded into Postgres; also used as in-memory fallback. */
export const DEFAULT_INTENT_RULES: IntentRule[] = [
  { intent: 'billing', team: 'billing', basePriority: 5, reason: 'intent:billing→team:billing' },
  { intent: 'refund', team: 'billing', basePriority: 6, reason: 'intent:refund→team:billing' },
  {
    intent: 'cancellation',
    team: 'retention',
    basePriority: 7,
    reason: 'intent:cancellation→team:retention',
  },
  { intent: 'support', team: 'support', basePriority: 4, reason: 'intent:support→team:support' },
  { intent: 'greeting', team: 'general', basePriority: 2, reason: 'intent:greeting→team:general' },
  {
    intent: 'general_inquiry',
    team: 'general',
    basePriority: 3,
    reason: 'intent:general_inquiry→team:general',
  },
  { intent: 'unknown', team: 'general', basePriority: 5, reason: 'intent:unknown→team:general' },
];

function clampPriority(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

/**
 * Pure, deterministic routing engine. Every branch appends to `reason[]` so the
 * decision is explainable (no black box). Unit-testable without I/O.
 */
export function decideRoute(
  input: RoutingInput,
  options: { minConfidence: number; rules?: IntentRule[] } = { minConfidence: 0.7 },
): RoutingDecision {
  const rules = options.rules ?? DEFAULT_INTENT_RULES;
  const reason: string[] = [];
  const minConfidence = options.minConfidence;

  // 1) Low / zero confidence → human handoff first-class path.
  if (input.confidence < minConfidence) {
    reason.push(`confidence:${input.confidence}<${minConfidence}`);
    reason.push('handoff:LOW_AI_CONFIDENCE');
    const rule =
      rules.find((r) => r.intent === input.intent) ?? rules.find((r) => r.intent === 'unknown');
    const team = rule?.team ?? 'general';
    reason.push(`team:${team} (handoff queue)`);
    let priority = clampPriority((rule?.basePriority ?? 5) + 2);
    if (input.sentiment === 'negative') {
      priority = clampPriority(priority + 1);
      reason.push('sentiment:negative→priority+1');
    }
    return {
      assignedTeam: team,
      priority,
      reason,
      handoffToHuman: true,
      handoffReason: 'LOW_AI_CONFIDENCE',
    };
  }

  reason.push(`confidence:${input.confidence}>=${minConfidence}`);

  // 2) Intent → team
  const rule = rules.find((r) => r.intent === input.intent);
  let team: string;
  let priority: number;
  if (rule) {
    team = rule.team;
    priority = rule.basePriority;
    reason.push(rule.reason);
  } else {
    team = 'general';
    priority = 4;
    reason.push(`intent:${input.intent} unmatched→team:general`);
  }

  // 3) Sentiment adjustments
  if (input.sentiment === 'negative') {
    priority = clampPriority(priority + 2);
    reason.push('sentiment:negative→priority+2');
  } else if (input.sentiment === 'positive') {
    priority = clampPriority(priority - 1);
    reason.push('sentiment:positive→priority-1');
  } else {
    reason.push('sentiment:neutral→no priority change');
  }

  // 4) Channel hint (optional)
  if (input.channel === 'email') {
    priority = clampPriority(priority - 1);
    reason.push('channel:email→priority-1 (async)');
  } else if (input.channel === 'whatsapp' || input.channel === 'webchat') {
    reason.push(`channel:${input.channel}→realtime`);
  }

  // 5) Customer VIP boost (optional future hook)
  if (input.customerPriorityBoost !== undefined && input.customerPriorityBoost > 0) {
    priority = clampPriority(priority + input.customerPriorityBoost);
    reason.push(`customer:priorityBoost+${input.customerPriorityBoost}`);
  }

  return {
    assignedTeam: team,
    priority: clampPriority(priority),
    reason,
    handoffToHuman: false,
  };
}
