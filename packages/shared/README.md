# @cx-orbit/shared

Canonical contracts shared across every CX-ORBIT service: the **event envelope**, the **canonical message
model**, all **event payload schemas**, **validation helpers** and **ID generators**.

> This package contains **contracts only** — no business logic, no infrastructure (ADR-009 / ADR-010).
> It is the single source of truth referenced by [`docs/events/event-catalog.md`](../../docs/events/event-catalog.md).

## What's inside

```text
src/
├── enums.ts            # Channel, Sentiment, ConversationStatus, IncidentType, ...
├── ids.ts              # newEventId / newCorrelationId / newTraceId (OTel-compatible) ...
├── messages.ts         # Sender, MessageContent, CanonicalInboundMessage
├── events/
│   ├── payloads.ts     # EventType + a Zod schema & TS type per event
│   ├── envelope.ts     # EventEnvelopeBaseSchema + typed EventEnvelope<T> + AnyEvent
│   └── registry.ts     # versioned registry + createEvent / parseEvent / safeParseEvent
└── index.ts
```

## Usage

```ts
import { createEvent, parseEvent, type EventEnvelope } from '@cx-orbit/shared';

// Produce a validated event (ids + timestamp auto-filled):
const event = createEvent({
  eventType: 'message.received',
  source: 'channel-gateway',
  payload: {
    channel: 'whatsapp',
    externalMessageId: 'wa_msg_123',
    sender: { externalId: '+5491112345678', displayName: 'Customer' },
    content: { type: 'text', text: 'No puedo pagar mi factura' },
  },
});

// Consume/validate a raw event off the bus (throws on invalid):
const parsed = parseEvent(rawFromNats);
if (parsed.eventType === 'ai.analysis.completed') {
  parsed.payload.confidence; // fully typed
}
```

- `createEvent` and `parseEvent` **validate the payload** against the versioned registry, so malformed
  events cannot be produced or consumed.
- `safeParseEvent` is the non-throwing variant.
- Delivery is at-least-once, so consumers must still be **idempotent** on `eventId` (ADR-004).

## Event versioning

Each `eventType` maps to `version -> Zod schema` in `registry.ts`. Additive changes keep the version;
breaking changes add a new version key (old one retained during migration). See the
[event catalog](../../docs/events/event-catalog.md#versioning-policy).

## Scripts

```bash
pnpm --filter @cx-orbit/shared build       # emit dist/ (tsc)
pnpm --filter @cx-orbit/shared typecheck   # type-check src + tests
pnpm --filter @cx-orbit/shared test        # run Vitest unit tests
```
