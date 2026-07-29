import type { AnyEvent } from '@cx-orbit/shared';
import type { AnalyticsMetrics } from './metrics.js';

export interface AnalyticsSnapshot {
  messagesInbound: number;
  messagesOutbound: number;
  conversationsCreated: number;
  conversationsResolved: number;
  customersCreated: number;
  aiAnalyses: number;
  aiLowConfidence: number;
  routingDecisions: number;
  routingHandoffs: number;
  deliveriesSent: number;
  deliveriesFailed: number;
  eventsByType: Record<string, number>;
}

const CONTAINMENT_THRESHOLD = 0.7;

/**
 * In-memory rollup + Prometheus updates. Pure enough to unit-test via the
 * snapshot; Prometheus counters are a side effect of {@link recordEvent}.
 */
export function createAggregator(metrics: AnalyticsMetrics) {
  const snap: AnalyticsSnapshot = {
    messagesInbound: 0,
    messagesOutbound: 0,
    conversationsCreated: 0,
    conversationsResolved: 0,
    customersCreated: 0,
    aiAnalyses: 0,
    aiLowConfidence: 0,
    routingDecisions: 0,
    routingHandoffs: 0,
    deliveriesSent: 0,
    deliveriesFailed: 0,
    eventsByType: {},
  };

  function bumpType(type: string): void {
    snap.eventsByType[type] = (snap.eventsByType[type] ?? 0) + 1;
    metrics.eventsConsumed.inc({ type });
    metrics.lastEventUnix.set({ type }, Date.now() / 1000);
  }

  function recordEvent(event: AnyEvent): void {
    bumpType(event.eventType);

    switch (event.eventType) {
      case 'message.received':
        snap.messagesInbound += 1;
        metrics.messagesByChannel.inc({ channel: event.payload.channel, direction: 'inbound' });
        break;
      case 'conversation.created':
        snap.conversationsCreated += 1;
        metrics.conversationsCreated.inc({ channel: event.payload.channel });
        break;
      case 'conversation.resolved':
        snap.conversationsResolved += 1;
        metrics.conversationsResolved.inc({ resolved_by: event.payload.resolvedBy });
        if (event.payload.resolutionTimeMs !== undefined) {
          metrics.resolutionTimeSeconds.observe(
            { resolved_by: event.payload.resolvedBy },
            event.payload.resolutionTimeMs / 1000,
          );
        }
        break;
      case 'customer.created':
        snap.customersCreated += 1;
        metrics.customersCreated.inc();
        break;
      case 'ai.analysis.completed':
        snap.aiAnalyses += 1;
        metrics.aiAnalyses.inc({
          intent: event.payload.intent,
          sentiment: event.payload.sentiment,
        });
        if (event.payload.confidence < CONTAINMENT_THRESHOLD) {
          snap.aiLowConfidence += 1;
          metrics.aiLowConfidence.inc();
        }
        break;
      case 'routing.completed': {
        snap.routingDecisions += 1;
        const handoff = event.payload.handoffToHuman === true;
        if (handoff) snap.routingHandoffs += 1;
        metrics.routingDecisions.inc({
          team: event.payload.assignedTeam,
          handoff: handoff ? 'true' : 'false',
        });
        break;
      }
      case 'message.sent':
        snap.messagesOutbound += 1;
        snap.deliveriesSent += 1;
        metrics.messagesByChannel.inc({ channel: event.payload.channel, direction: 'outbound' });
        metrics.deliveryResults.inc({ channel: event.payload.channel, result: 'sent' });
        break;
      case 'message.delivery.failed':
        snap.deliveriesFailed += 1;
        metrics.deliveryResults.inc({ channel: event.payload.channel, result: 'failed' });
        metrics.deliveryFailures.inc({
          channel: event.payload.channel,
          reason: event.payload.reason,
        });
        break;
      default:
        break;
    }
  }

  function snapshot(): AnalyticsSnapshot {
    return {
      ...snap,
      eventsByType: { ...snap.eventsByType },
    };
  }

  return { recordEvent, snapshot };
}

export type Aggregator = ReturnType<typeof createAggregator>;
