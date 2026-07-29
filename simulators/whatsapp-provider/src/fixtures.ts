/**
 * WhatsApp Cloud API inbound webhook fixtures used by the channel-gateway
 * adapter contract and Phase 12 e2e tests.
 */

export interface WhatsAppTextFixtureOptions {
  messageId: string;
  from?: string;
  text?: string;
  displayName?: string;
}

/** Build a minimal Cloud API webhook payload with one text message. */
export function buildWhatsAppTextWebhook(options: WhatsAppTextFixtureOptions) {
  const from = options.from ?? '5491112345678';
  const text = options.text ?? 'hola desde whatsapp e2e';
  const displayName = options.displayName ?? 'Ana';

  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_E2E',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550001111', phone_number_id: 'PNID' },
              contacts: [{ profile: { name: displayName }, wa_id: from }],
              messages: [
                {
                  from,
                  id: options.messageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

/** Canonical shape the gateway WhatsApp adapter must produce for the fixture. */
export function expectedCanonicalFromFixture(options: WhatsAppTextFixtureOptions) {
  const from = options.from ?? '5491112345678';
  const text = options.text ?? 'hola desde whatsapp e2e';
  const displayName = options.displayName ?? 'Ana';
  return {
    channel: 'whatsapp' as const,
    externalMessageId: options.messageId,
    externalConversationId: from,
    sender: { externalId: `+${from}`, displayName },
    content: { type: 'text' as const, text },
  };
}
