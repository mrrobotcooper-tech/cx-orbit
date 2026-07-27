# Canonical Event Catalog

> **Status:** ✅ Implemented in **Phase 2** under [`packages/shared`](../../packages/shared). The Zod schemas
> and TypeScript types in `packages/shared/src/events` are the executable source of truth; this document is the
> human-readable companion. Keep both in sync.

Every event on the bus shares the **envelope** below. `payload` is specific to each `eventType` and is
validated with Zod. Events are **versioned** per `eventType`.

## Envelope

```jsonc
{
  "eventId": "evt_123",          // unique; used for consumer-side idempotency
  "eventType": "message.received",
  "version": 1,                   // schema version for this eventType
  "occurredAt": "2026-07-25T12:00:00.000Z", // ISO-8601 UTC
  "correlationId": "corr_123",    // one logical customer interaction
  "traceId": "trace_123",         // distributed trace id
  "source": "channel-gateway",    // producing service
  "payload": { /* type-specific */ }
}
```

## Versioning policy

- **Additive (backward-compatible) changes** (new optional field) → **do not** bump `version`.
- **Breaking changes** (remove/rename/retype a field, change semantics) → **bump `version`** and support both
  during a migration window. Consumers switch on `version`.
- A new `eventType` is always introduced at `version: 1`.
- Schemas are the single source of truth in `packages/shared/src/events`.

## Naming convention

`domain.action` in past tense for facts (`message.received`, `conversation.created`) and
`domain.action.requested` for commands/intents (`message.send.requested`).

## Event Registry

| Event Type | Ver | Producer | Key Consumers | Purpose |
| ---------- | --- | -------- | ------------- | ------- |
| `message.received` | 1 | channel-gateway | conversation, customer, analytics | Canonical inbound message ingested. |
| `message.normalized` | 1 | channel-gateway | (internal) | Normalization completed (optional granularity). |
| `customer.identified` | 1 | customer-service | conversation, routing, analytics | Existing customer resolved for a message. |
| `customer.created` | 1 | customer-service | conversation, analytics | New customer profile created. |
| `conversation.created` | 1 | conversation-service | ai, analytics | New conversation opened. |
| `conversation.updated` | 1 | conversation-service | analytics | Conversation state/fields changed. |
| `ai.analysis.completed` | 1 | ai-service | routing, conversation, analytics | Intent/sentiment/entities/summary ready. |
| `routing.completed` | 1 | routing-service | conversation, analytics | Team + priority + explainable reason decided. |
| `conversation.assigned` | 1 | routing-service / conversation | analytics | Conversation assigned to team/agent. |
| `message.send.requested` | 1 | conversation-service | outbound | Command: deliver an outbound message. |
| `message.sent` | 1 | outbound-service | conversation, analytics | Provider accepted/delivered the message. |
| `message.delivery.failed` | 1 | outbound-service | conversation, analytics | Delivery failed after retries (→ DLQ). |
| `conversation.resolved` | 1 | conversation-service | analytics | Conversation resolved. |
| `incident.started` | 1 | incident-simulator | all, analytics | A controlled incident began. |
| `incident.ended` | 1 | incident-simulator | all, analytics | A controlled incident ended. |

## Payload sketches (finalized in Phase 2)

### `message.received`

```jsonc
{
  "channel": "whatsapp",
  "externalMessageId": "wa_msg_123",
  "externalConversationId": "wa_conv_123",
  "sender": { "externalId": "+5491112345678", "displayName": "Customer" },
  "content": { "type": "text", "text": "No puedo pagar mi factura" },
  "metadata": {}
}
```

### `ai.analysis.completed`

```jsonc
{
  "conversationId": "conv_123",
  "intent": "billing",
  "sentiment": "negative",
  "confidence": 0.91,
  "entities": { "service": "mobile", "issue": "invoice" }
}
```

### `routing.completed`

```jsonc
{
  "conversationId": "conv_123",
  "assignedTeam": "billing",
  "priority": 4,
  "reason": ["intent=billing", "sentiment=negative", "customer_priority=normal"]
}
```

## Delivery semantics

- The bus delivers **at least once** → all consumers must be **idempotent** on `eventId` (see
  [ADR-004](../adr/ADR-004-idempotency-strategy.md)).
- Reliable publishing across DB writes uses the **Outbox Pattern**
  ([ADR-005](../adr/ADR-005-outbox-pattern.md)).
