import {
  connect,
  JSONCodec,
  RetentionPolicy,
  StorageType,
  type JetStreamClient,
  type JetStreamManager,
  type NatsConnection,
} from 'nats';
import type { AnyEvent } from '@cx-orbit/shared';

const codec = JSONCodec<AnyEvent>();

/** All canonical events are published under this subject namespace. */
export const EVENT_SUBJECT_PREFIX = 'cxorbit.events';
export const eventSubject = (eventType: string): string => `${EVENT_SUBJECT_PREFIX}.${eventType}`;

export interface EventBusOptions {
  url: string;
  streamName?: string;
  /** JetStream msgID de-duplication window, in seconds. Defaults to 120. */
  dedupWindowSeconds?: number;
}

export interface PublishResult {
  /** Stream sequence assigned to the message. */
  seq: number;
  /** True if JetStream recognized this msgID as a duplicate within the window. */
  duplicate: boolean;
}

export interface EventBus {
  connection: NatsConnection;
  js: JetStreamClient;
  jsm: JetStreamManager;
  streamName: string;
  /** Publish a canonical event. Uses eventId as msgID for broker-level dedup. */
  publish(event: AnyEvent): Promise<PublishResult>;
  close(): Promise<void>;
}

async function ensureStream(
  jsm: JetStreamManager,
  name: string,
  dedupWindowNanos: number,
): Promise<void> {
  try {
    await jsm.streams.info(name);
  } catch {
    await jsm.streams.add({
      name,
      subjects: [`${EVENT_SUBJECT_PREFIX}.>`],
      storage: StorageType.File,
      retention: RetentionPolicy.Limits,
      duplicate_window: dedupWindowNanos,
    });
  }
}

/**
 * Connect to NATS, ensure the JetStream stream exists, and return a thin
 * event-bus wrapper. Publishing sets `msgID = eventId`, giving broker-level
 * de-duplication that complements consumer-side idempotency (ADR-001/ADR-004).
 */
export async function connectEventBus(options: EventBusOptions): Promise<EventBus> {
  const streamName = options.streamName ?? 'CXORBIT';
  const dedupWindowNanos = (options.dedupWindowSeconds ?? 120) * 1_000_000_000;

  const connection = await connect({ servers: options.url });
  const jsm = await connection.jetstreamManager();
  await ensureStream(jsm, streamName, dedupWindowNanos);
  const js = connection.jetstream();

  return {
    connection,
    js,
    jsm,
    streamName,
    async publish(event: AnyEvent): Promise<PublishResult> {
      const ack = await js.publish(eventSubject(event.eventType), codec.encode(event), {
        msgID: event.eventId,
      });
      return { seq: ack.seq, duplicate: ack.duplicate };
    },
    async close(): Promise<void> {
      await connection.drain();
    },
  };
}

/** Codec for decoding raw JetStream messages back into typed events. */
export const eventCodec = codec;
