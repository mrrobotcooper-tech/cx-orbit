# ADR-002 — Channel Adapter Boundaries

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** Backend Engineer, Distributed Systems Architect

## Context

CX-ORBIT supports seven channels (WhatsApp, Telegram, Email, Instagram, Facebook, X, Web Chat). Each real
provider has a different payload shape, authentication scheme (signatures, tokens), delivery semantics, and
error catalog. If provider-specific details leak into the domain, every service becomes coupled to every
provider, and adding a channel means touching the whole system.

## Decision

Introduce a single **`ChannelAdapter` abstraction** that is the **only** place provider specifics may live.

```ts
interface ChannelAdapter {
  channel: Channel;
  parseInboundEvent(payload: unknown): Promise<CanonicalInboundMessage>;
  sendMessage(request: SendMessageRequest): Promise<DeliveryResult>;
  validateWebhook(payload: unknown, headers: Record<string, string>): Promise<boolean>;
}
```

- **Inbound:** the Channel Gateway uses `validateWebhook` + `parseInboundEvent` to turn a provider payload
  into a `CanonicalInboundMessage`. Everything downstream sees only the canonical model.
- **Outbound:** the Outbound Service uses `sendMessage` to translate a canonical send request into a
  provider call and normalize the result into a `DeliveryResult`.
- Adapters talk to **Provider Simulators** locally, but their interface is identical to what real APIs need.

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| **Per-channel services** (a whole microservice per channel) | Enormous duplication of gateway/outbound logic; artificial services (violates ADR-010). |
| **`switch (channel)` inside domain services** | Provider logic bleeds everywhere; adding a channel edits many files; impossible to unit-test in isolation. |
| **A generic "translation" config (no code)** | Real providers need signature verification and quirky parsing that config alone cannot express. |

## Trade-offs

- **Pro:** adding a channel = implement one adapter + one simulator; zero domain changes.
- **Pro:** adapters are independently **contract-testable** against their simulators.
- **Pro:** clean seam to inject provider-level failures (timeouts, 500s, rate limits) for incidents.
- **Con:** an abstraction that must be general enough for all channels risks lowest-common-denominator design.
  Mitigated by allowing channel-specific `metadata` on the canonical model.
- **Con:** two mappings to maintain per channel (in + out).

## Consequences

- Provider-specific types **never** appear outside `services/channel-gateway` and `services/outbound-service`
  adapter modules.
- The canonical model + adapter interface live in `packages/shared`.
- Contract tests (Phase 12) assert every adapter satisfies the interface against its simulator.
- Incident injection for provider failures targets the adapter↔simulator seam.
