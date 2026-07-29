import { buildWhatsAppTextWebhook } from '@cx-orbit/whatsapp-provider';
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_URL,
  CONVERSATION_URL,
  GATEWAY_URL,
  fetchSummary,
  postJson,
  waitFor,
} from './helpers.js';

/**
 * Full WhatsApp → analytics pipeline. Requires infra + services running:
 *   pnpm infra:up
 *   (gateway, conversation, customer, ai, routing, outbound, analytics, …)
 *   RUN_E2E=1 pnpm --filter @cx-orbit/e2e test:e2e
 */
const RUN = process.env.RUN_E2E === '1';
const suite = RUN ? describe : describe.skip;

suite('e2e WhatsApp → analytics', () => {
  it('accepts a WhatsApp webhook and advances analytics inbound count', async () => {
    const before = await fetchSummary();
    const messageId = `wamid.e2e_${Date.now()}`;
    const payload = buildWhatsAppTextWebhook({
      messageId,
      text: `e2e pipeline ${messageId}`,
    });

    const accepted = await postJson(`${GATEWAY_URL}/webhooks/whatsapp`, payload);
    expect([200, 202]).toContain(accepted.status);
    expect((accepted.json as { status?: string }).status).toMatch(/accepted|duplicate/);

    await waitFor(
      async () => {
        const snap = await fetchSummary();
        return snap.business.messagesInbound > before.business.messagesInbound;
      },
      { label: 'analytics messagesInbound increase', timeoutMs: 60_000 },
    );

    const after = await fetchSummary();
    expect(after.business.messagesInbound).toBeGreaterThan(before.business.messagesInbound);

    // Conversation service should expose the WhatsApp thread eventually.
    await waitFor(
      async () => {
        const res = await fetch(`${CONVERSATION_URL}/conversations?channel=whatsapp&pageSize=20`);
        if (!res.ok) return false;
        const body = (await res.json()) as { data: Array<{ messageCount: number }> };
        return body.data.some((c) => c.messageCount >= 1);
      },
      { label: 'conversation list contains whatsapp', timeoutMs: 45_000 },
    );

    // Downstream consumers should advance at least one pipeline metric.
    await waitFor(
      async () => {
        const snap = await fetchSummary();
        return (
          snap.business.conversationsCreated > before.business.conversationsCreated ||
          snap.business.aiAnalyses > before.business.aiAnalyses ||
          snap.business.routingDecisions > before.business.routingDecisions
        );
      },
      { label: 'downstream pipeline metrics', timeoutMs: 60_000 },
    );

    // Sanity: analytics is reachable (documents the e2e target).
    const health = await fetch(`${ANALYTICS_URL}/health`);
    expect(health.ok).toBe(true);
  });
});
