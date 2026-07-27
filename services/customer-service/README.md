# @cx-orbit/customer-service

The **Customer Service** owns **cross-channel customer identity**. It consumes
`message.received`, resolves (or creates) the sender's identity in PostgreSQL, and
publishes `customer.created` / `customer.identified` via the transactional Outbox.

## Responsibilities

- Consume `message.received` → resolve identity by `(channel, externalId)`.
  - Known identity → no-op (mapping already announced).
  - New identity → create `customer` + `identity`, emit `customer.created` +
    `customer.identified` (outbox).
- Expose a REST API to read customers and reverse-lookup by identity.

## Data model (PostgreSQL, `customer` schema)

- `customer.customers` — the person (id, display name, timestamps).
- `customer.identities` — per-channel identity. **Unique `(channel, external_id)`**
  is the resolution + idempotency guard.
- `customer.outbox` — pending/published domain events (relayed to NATS).

Identity resolution is currently **per `(channel, externalId)`**: the same external
id on the same channel always maps to the same customer. Cross-channel merge (by a
shared contact such as verified email/phone) is a documented future extension.

## REST API

| Method | Path                                          | Purpose                        |
| ------ | --------------------------------------------- | ------------------------------ |
| GET    | `/customers`                                  | List (filter `channel`, pages) |
| GET    | `/customers/:id`                              | Customer + identities          |
| GET    | `/customers/resolve?channel=&externalId=`     | Reverse lookup by identity     |
| GET    | `/health` `/ready` `/metrics`                 | Ops endpoints                  |

## Configuration

| Env                      | Default                                                  |
| ------------------------ | ------------------------------------------------------- |
| `CUSTOMER_SERVICE_PORT`  | `8082`                                                  |
| `POSTGRES_URL`           | `postgresql://cxorbit:cxorbit@localhost:5433/cxorbit`   |
| `NATS_URL`               | `nats://localhost:4222`                                  |
| `CONSUMER_DURABLE`       | `customer-service`                                       |

> Note: the host maps Postgres to **5433** (see `.env.example`), so the default
> connection string uses that port for host-run services.

## Local development

Infra up (`pnpm infra:up`), then from the repo root:

```bash
pnpm --filter @cx-orbit/customer-service dev
```

Drive it via the gateway (send a webhook) and then:

```bash
curl -s 'http://localhost:8082/customers?pageSize=5'
curl -s 'http://localhost:8082/customers/resolve?channel=webchat&externalId=visitor_1'
```
