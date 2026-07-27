import type { CanonicalInboundMessage, Channel } from '@cx-orbit/shared';

/**
 * Inbound-only view of a channel adapter. The full {@link ChannelAdapter}
 * contract (with `sendMessage`) belongs to the Outbound Service (Phase 8); the
 * gateway only ingests, so it depends on this narrower surface.
 */
export interface InboundAdapter {
  readonly channel: Channel;
  /**
   * Parse and normalize a provider-specific webhook body into a canonical
   * inbound message. MUST throw (ZodError) on malformed payloads.
   */
  parseInboundEvent(payload: unknown): Promise<CanonicalInboundMessage>;
  /**
   * Authenticate the webhook call. Returns false to reject with 401.
   */
  validateWebhook(payload: unknown, headers: Record<string, string>): Promise<boolean>;
}

export interface AdapterOptions {
  /** Shared secret; when undefined the adapter runs in permissive dev mode. */
  secret?: string | undefined;
}

/**
 * Simulated webhook authentication: real providers use HMAC signatures
 * (`X-Hub-Signature-256`, etc.), but for the local lab we accept a shared token
 * header. When no secret is configured, all calls pass (dev mode).
 */
export function tokenValidator(secret: string | undefined) {
  return async (_payload: unknown, headers: Record<string, string>): Promise<boolean> => {
    if (!secret) return true;
    return headers['x-webhook-token'] === secret;
  };
}

/** Narrow an index-access value that a schema guarantees to be present. */
export function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`Expected ${what} to be present after schema validation`);
  }
  return value;
}
