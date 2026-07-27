import type { Channel } from '@cx-orbit/shared';
import type { AdapterOptions, InboundAdapter } from './base.js';
import { createEmailAdapter } from './email.js';
import { createFacebookAdapter } from './facebook.js';
import { createInstagramAdapter } from './instagram.js';
import { createTelegramAdapter } from './telegram.js';
import { createWebChatAdapter } from './webchat.js';
import { createWhatsAppAdapter } from './whatsapp.js';
import { createXAdapter } from './x.js';

export * from './base.js';

/**
 * Build the full adapter registry keyed by channel. The `satisfies` clause makes
 * it a compile error to add a `Channel` without providing an adapter for it.
 */
export function createAdapters(options: AdapterOptions = {}): Record<Channel, InboundAdapter> {
  return {
    webchat: createWebChatAdapter(options),
    whatsapp: createWhatsAppAdapter(options),
    telegram: createTelegramAdapter(options),
    email: createEmailAdapter(options),
    instagram: createInstagramAdapter(options),
    facebook: createFacebookAdapter(options),
    x: createXAdapter(options),
  } satisfies Record<Channel, InboundAdapter>;
}
