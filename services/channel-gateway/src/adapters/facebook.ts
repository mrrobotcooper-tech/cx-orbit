import { type AdapterOptions, type InboundAdapter } from './base.js';
import { createMessengerAdapter } from './messenger.js';

export function createFacebookAdapter(options: AdapterOptions = {}): InboundAdapter {
  return createMessengerAdapter('facebook', options);
}
