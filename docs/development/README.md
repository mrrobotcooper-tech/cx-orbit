# Development Guide

> How to work on CX-ORBIT locally, plus conventions every contributor (human or agent) should follow.

## Prerequisites

- Node.js **>= 20**
- pnpm **>= 9** (`npm install -g pnpm`)
- Docker + Docker Compose v2

## First-time setup

```bash
pnpm install
cp .env.example .env
```

## Common commands

| Command | What it does |
| ------- | ------------ |
| `pnpm install` | Install all workspace dependencies |
| `docker compose up -d` | Start infrastructure (Phase 1+) |
| `pnpm dev` | Run all services in watch mode |
| `pnpm --filter <pkg> dev` | Run a single service/package |
| `pnpm lint` | ESLint across the monorepo |
| `pnpm typecheck` | TypeScript project references typecheck |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test` | All tests (Vitest); IT/e2e skipped unless flagged |
| `pnpm test:unit` / `:integration` / `:e2e` | Test tiers — see [testing.md](./testing.md) |
| `pnpm checklist` | Smoke health + unit tests (services must be up) |
| `pnpm docker:build` | Build all app Docker images locally |

Interview narrative: [walkthrough](../interview/walkthrough.md).

## Repository conventions

- **Monorepo:** pnpm workspaces. Shared contracts live in `packages/shared` — **contracts only**, no business logic.
- **Language:** TypeScript **strict** everywhere (`tsconfig.base.json`).
- **HTTP:** Fastify. **Validation:** Zod. **Logging:** Pino (structured JSON).
- **Testing:** Vitest for unit + integration + e2e (single, consistent strategy).
- **Layering per service** (applied pragmatically, not dogmatically):

  ```text
  Interface (Fastify routes/controllers)
      ↓
  Application Service (use cases)
      ↓
  Domain Logic (pure, testable)
      ↓
  Repository Interface
      ↓
  Infrastructure Adapter (Mongo/Postgres/Redis/NATS/provider)
  ```

- **No secrets in code.** Config via env (`.env`, documented in `.env.example`).
- **No direct cross-service DB access.** Integrate via events/APIs only (ADR-009).
- **Every service exposes** `/health`, `/ready`, `/metrics` and propagates `correlationId`/`traceId`.

## Definition of Done (per phase)

A phase is done only when: code compiles, `pnpm typecheck` passes, `pnpm lint` passes, the phase's tests pass,
relevant services start, no broken imports, and cross-service contracts stay consistent. See
[`roadmap.md`](roadmap.md) for per-phase acceptance criteria.

## Documents

- [Roadmap & phase acceptance criteria](roadmap.md)
- [Architecture overview](../architecture/overview.md)
- [ADRs](../adr/)
- [Event catalog](../events/event-catalog.md)
