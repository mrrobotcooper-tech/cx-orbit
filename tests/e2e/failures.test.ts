import { buildWhatsAppTextWebhook } from '@cx-orbit/whatsapp-provider';
import { describe, expect, it } from 'vitest';
import { GATEWAY_URL, INCIDENTS_URL, postJson, sleep } from './helpers.js';

/**
 * Live failure probes against a running stack. Opt-in with RUN_E2E=1.
 * Unit/IT suites cover the same failure modes with fakes; this asserts the
 * control plane + gateway behave under real ports.
 */
const RUN = process.env.RUN_E2E === '1';
const suite = RUN ? describe : describe.skip;

suite('e2e failure modes', () => {
  it('duplicate WhatsApp delivery is idempotent at the gateway', async () => {
    const messageId = `wamid.dup_${Date.now()}`;
    const payload = buildWhatsAppTextWebhook({ messageId, text: 'duplicate probe' });

    const first = await postJson(`${GATEWAY_URL}/webhooks/whatsapp`, payload);
    expect(first.status).toBe(202);

    const second = await postJson(`${GATEWAY_URL}/webhooks/whatsapp`, payload);
    expect(second.status).toBe(200);
    expect((second.json as { status: string }).status).toBe('duplicate');
  });

  it('incident simulator can start and stop PROVIDER_TIMEOUT', async () => {
    const start = await postJson(`${INCIDENTS_URL}/incidents/start`, {
      code: 'INC-002',
      durationSeconds: 15,
    });
    // 201 started, or 409 if already active from a parallel run
    expect([201, 409]).toContain(start.status);

    if (start.status === 201) {
      const incidentId = (start.json as { incidentId: string }).incidentId;
      const stop = await postJson(`${INCIDENTS_URL}/incidents/${incidentId}/stop`, {});
      expect(stop.status).toBe(200);
    } else {
      await postJson(`${INCIDENTS_URL}/incidents/stop-all`, {});
    }

    await sleep(200);
    const list = await fetch(`${INCIDENTS_URL}/incidents`);
    expect(list.ok).toBe(true);
    const body = (await list.json()) as { active: unknown[] };
    expect(body.active.every((a) => (a as { code: string }).code !== 'INC-002')).toBe(true);
  });
});
