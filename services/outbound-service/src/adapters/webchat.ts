import type { OutboundAdapter, SendMessageInput, SendMessageResult } from './types.js';
import { ProviderDeliveryError } from './types.js';

export type WebChatSimulateFault = 'none' | 'timeout' | 'error' | 'rate_limit';

export interface WebChatAdapterOptions {
  baseUrl: string;
  /** Injected into simulator via x-simulate-fault header. */
  simulateFault?: WebChatSimulateFault;
  /**
   * Dynamic fault resolver (Redis flags from Incident Simulator).
   * Wins over `simulateFault` when it returns a non-none value.
   */
  getSimulateFault?: () => Promise<WebChatSimulateFault> | WebChatSimulateFault;
  fetchImpl?: typeof fetch;
}

export function createWebChatAdapter(options: WebChatAdapterOptions): OutboundAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function resolveFault(): Promise<WebChatSimulateFault> {
    if (options.getSimulateFault) {
      const dynamic = await options.getSimulateFault();
      if (dynamic !== 'none') return dynamic;
    }
    return options.simulateFault ?? 'none';
  }

  return {
    channel: 'webchat',
    async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
      if (input.content.type !== 'text' || !input.content.text) {
        throw new ProviderDeliveryError('webchat only supports text', 'INVALID_RECIPIENT', false);
      }

      const fault = await resolveFault();
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (fault !== 'none') headers['x-simulate-fault'] = fault;

      let response: Response;
      try {
        response = await fetchImpl(`${options.baseUrl}/v1/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: input.recipientExternalId,
            text: input.content.text,
            idempotencyKey: input.idempotencyKey,
          }),
        });
      } catch (err) {
        throw new ProviderDeliveryError(
          err instanceof Error ? err.message : 'network error',
          'TIMEOUT',
          true,
        );
      }

      if (response.status === 429) {
        throw new ProviderDeliveryError('rate limited', 'RATE_LIMITED', true, 429);
      }
      if (response.status >= 500) {
        throw new ProviderDeliveryError('provider 5xx', 'PROVIDER_ERROR', true, response.status);
      }
      if (!response.ok) {
        throw new ProviderDeliveryError(
          `provider ${response.status}`,
          'INVALID_RECIPIENT',
          false,
          response.status,
        );
      }

      const body = (await response.json()) as { providerMessageId?: string };
      return {
        providerMessageId: body.providerMessageId ?? 'unknown',
        attempts: 1,
      };
    },
  };
}
