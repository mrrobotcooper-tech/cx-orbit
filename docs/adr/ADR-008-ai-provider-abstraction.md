# ADR-008 — AI Provider Abstraction

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** AI Engineer, Backend Engineer

## Context

The AI Service classifies intent, analyzes sentiment, extracts entities and summarizes conversations. We want
the platform to run **fully locally with no external API** by default, while allowing real LLM providers to be
plugged in. LLMs are also **unreliable**: they can return invalid JSON, hallucinate, be slow, rate-limit, or
error. The platform must never let a bad model response break the flow.

## Decision

Define a provider-agnostic **`AIProvider` interface** and select the implementation via configuration:

```ts
interface AIProvider {
  classifyIntent(input: string): Promise<IntentResult>;
  analyzeSentiment(input: string): Promise<SentimentResult>;
  extractEntities(input: string): Promise<EntityResult>;
  summarizeConversation(messages: Message[]): Promise<SummaryResult>;
}
```

- **`MockAIProvider`** is the default (`AI_PROVIDER=mock`) — deterministic, offline, fast.
- Optional `OpenAIProvider`, `AnthropicProvider`, `LocalProvider` selectable via `AI_PROVIDER`.
- **All provider output is strictly validated with Zod** before use. Invalid output is rejected, logged, and
  triggers a **fallback** (low-confidence path → human handoff).
- Simulated AI failure modes: `LOW_CONFIDENCE`, `INVALID_JSON`, `TIMEOUT`, `RATE_LIMIT`, `HALLUCINATION`,
  `PROVIDER_ERROR`.

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| **Hard-code one vendor SDK** | Couples the platform to a paid API; can't run offline; can't swap models. |
| **Trust model output directly** | A single malformed response would crash routing — exactly the anti-pattern INC-005 teaches against. |
| **No mock, require API keys** | Breaks the "runs locally with `docker compose up`" success criterion. |

## Trade-offs

- **Pro:** offline-by-default, vendor-swappable, testable (deterministic mock).
- **Pro:** enables **INC-005 (AI Invalid Response)** with validate → reject → log → fallback → route to human.
- **Con:** the interface must be stable across very different providers; results are normalized to our schema.
- **Con:** strict validation may reject borderline-but-usable output; acceptable — safety over cleverness.

## Consequences

- The system boots and passes tests with `AI_PROVIDER=mock` and **no** API keys.
- AI result schemas live in `packages/shared`; the service validates before emitting `ai.analysis.completed`.
- Confidence below `AI_MIN_CONFIDENCE` routes to human handoff (ties into ADR routing rules).
- API keys are read from env, never logged (ADR-007).
