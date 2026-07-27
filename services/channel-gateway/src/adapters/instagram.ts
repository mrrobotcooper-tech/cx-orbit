import { type AdapterOptions, type InboundAdapter } from './base.js';
import { createMessengerAdapter } from './messenger.js';

export function createInstagramAdapter(options: AdapterOptions = {}): InboundAdapter {
  return createMessengerAdapter('instagram', options);
}
