import type { Channel, MessageContent } from '@cx-orbit/shared';
import type { DeliveryFailureReason } from '@cx-orbit/shared';

export interface SendMessageInput {
  recipientExternalId: string;
  content: MessageContent;
  idempotencyKey: string;
}

export interface SendMessageResult {
  providerMessageId: string;
  attempts: number;
}

export class ProviderDeliveryError extends Error {
  constructor(
    message: string,
    readonly reason: DeliveryFailureReason,
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ProviderDeliveryError';
  }
}

/** Outbound-only adapter surface (ADR-002). */
export interface OutboundAdapter {
  readonly channel: Channel;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}
