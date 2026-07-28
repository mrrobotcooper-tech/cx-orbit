import type { Channel } from '@cx-orbit/shared';
import type { OutboundAdapter, SendMessageInput, SendMessageResult } from './types.js';
import { ProviderDeliveryError } from './types.js';
import { createWebChatAdapter, type WebChatAdapterOptions } from './webchat.js';

/** Stub for channels without a local simulator yet. */
function stubAdapter(channel: Channel): OutboundAdapter {
  return {
    channel,
    async sendMessage(_input: SendMessageInput): Promise<SendMessageResult> {
      throw new ProviderDeliveryError(
        `${channel} outbound adapter not implemented yet`,
        'PROVIDER_ERROR',
        false,
      );
    },
  };
}

export interface CreateAdaptersOptions {
  webchat: WebChatAdapterOptions;
}

export function createOutboundAdapters(
  options: CreateAdaptersOptions,
): Record<Channel, OutboundAdapter> {
  return {
    webchat: createWebChatAdapter(options.webchat),
    whatsapp: stubAdapter('whatsapp'),
    telegram: stubAdapter('telegram'),
    email: stubAdapter('email'),
    instagram: stubAdapter('instagram'),
    facebook: stubAdapter('facebook'),
    x: stubAdapter('x'),
  };
}

export * from './types.js';
export { createWebChatAdapter };
