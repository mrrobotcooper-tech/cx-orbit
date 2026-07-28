import type { HandoffReason, Sentiment } from '@cx-orbit/shared';

/** Input to the pure routing engine (no I/O). */
export interface RoutingInput {
  conversationId: string;
  intent: string;
  sentiment: Sentiment;
  confidence: number;
  channel?: string | undefined;
  /** Optional VIP / priority hint from customer profile (future). */
  customerPriorityBoost?: number | undefined;
}

export interface RoutingDecision {
  assignedTeam: string;
  priority: number;
  reason: string[];
  handoffToHuman: boolean;
  handoffReason?: HandoffReason | undefined;
}

export interface IntentRule {
  intent: string;
  team: string;
  basePriority: number;
  reason: string;
}
