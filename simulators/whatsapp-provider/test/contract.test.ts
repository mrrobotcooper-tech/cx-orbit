import { CanonicalInboundMessageSchema } from '@cx-orbit/shared';
import { describe, expect, it } from 'vitest';
import {
  buildWhatsAppTextWebhook,
  expectedCanonicalFromFixture,
} from '../src/fixtures.js';

describe('whatsapp-provider fixtures contract', () => {
  it('builds a Cloud API webhook with the expected entry/messages shape', () => {
    const payload = buildWhatsAppTextWebhook({ messageId: 'wamid.CONTRACT_1' });
    expect(payload.entry[0]?.changes[0]?.value.messages[0]?.id).toBe('wamid.CONTRACT_1');
    expect(payload.entry[0]?.changes[0]?.value.messages[0]?.text?.body).toContain('whatsapp');
  });

  it('documents a schema-valid canonical message for the gateway adapter', () => {
    const expected = expectedCanonicalFromFixture({ messageId: 'wamid.CONTRACT_2' });
    const parsed = CanonicalInboundMessageSchema.parse(expected);
    expect(parsed.channel).toBe('whatsapp');
    expect(parsed.externalMessageId).toBe('wamid.CONTRACT_2');
  });
});
