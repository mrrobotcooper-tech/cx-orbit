# CX-ORBIT Operator Console

React + Vite console for operators: live metrics, conversations, incident injection,
and lightweight observability.

## Stack

React · Vite · React Router · TanStack Query · Zustand · Recharts · Tailwind

## Dev

```bash
# from repo root (after pnpm install)
pnpm --filter @cx-orbit/frontend dev
# http://localhost:3000
```

Vite proxies `/svc/*` to local services (8081–8087) so CORS is not required.

| Prefix | Target |
| ------ | ------ |
| `/svc/conversation` | `:8081` |
| `/svc/customer` | `:8082` |
| `/svc/ai` | `:8083` |
| `/svc/routing` | `:8084` |
| `/svc/outbound` | `:8085` |
| `/svc/analytics` | `:8086` |
| `/svc/incidents` | `:8087` |

## Pages

- **Dashboard** — analytics `/summary` + active incidents
- **Conversations** — list/filter + detail (timeline, routing, on-demand AI analyze)
- **Incidents** — start/stop INC-001…006
- **Observability** — health probes, DLQ, circuit breaker, event chart; link to Grafana

## Scripts

```bash
pnpm --filter @cx-orbit/frontend typecheck
pnpm --filter @cx-orbit/frontend test
pnpm --filter @cx-orbit/frontend build
```
