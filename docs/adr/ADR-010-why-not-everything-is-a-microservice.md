# ADR-010 — Why Not Everything Is a Microservice

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** Distributed Systems Architect, SRE, Backend Engineer

## Context

It is tempting on a portfolio project to maximize the number of services to "look enterprise". This is an
anti-pattern: nano-services multiply network hops, failure modes, deployment units and cognitive load without
delivering ownership or scaling benefits. The brief explicitly warns against artificial microservices. This
ADR records what we deliberately **kept together** and why.

## Decision

Split only where there is a real boundary (ADR-009). Deliberately **do not** split the following:

1. **Channel adapters are libraries, not services.** Adapters live inside the Gateway (inbound) and Outbound
   (outbound) services. A "WhatsAppAdapterService" would add a network hop per message for pure translation.
2. **Provider simulators are grouped by purpose, not exploded further.** Each simulator is a small app; we do
   not split "message store" and "failure controller" into separate services within a simulator.
3. **The Outbox Publisher runs with its owning service**, not as a standalone service — it must share the DB
   transaction boundary conceptually and needs no independent scaling.
4. **No CRUD-per-table services.** Users/agents/teams live together in the Customer/Config domains, not one
   service each.
5. **Shared code is a library (`packages/shared`), not a "common service".** A network call for validation or
   logging would be absurd.
6. **Frontend is a single SPA**, not micro-frontends.

## Alternatives Considered

| Option | Why not |
| ------ | ------- |
| **Maximal microservices** | Operational and cognitive overhead, more partial-failure surface, slower flows, no ownership gain. |
| **Pure monolith** | Loses the distributed-systems demonstration that is the project's purpose (see ADR-009). |

## Trade-offs

- **Pro:** the system stays comprehensible and runnable on a laptop while still genuinely distributed.
- **Pro:** fewer artificial failure modes; the failures we do simulate are meaningful.
- **Con:** some components (adapters, outbox publisher) are coupled to a host service's deploy cycle — an
  acceptable trade for avoiding needless network boundaries.

## Consequences

- The service count is intentionally moderate (8 services + 7 simulators + 1 frontend).
- "Should this be a service?" is answered by ADR-009's ownership/rate-of-change test; if it fails, it stays a library.
- This ADR is the reference when someone proposes adding a service "for completeness".
