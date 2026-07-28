# WebChat Provider Simulator

Local stand-in for a WebChat messaging API used by the Outbound Service.

- `POST /v1/messages` — accept outbound messages (`201` + `providerMessageId`)
- `GET /messages` — last deliveries (debug)
- Fault injection header: `x-simulate-fault: timeout | error | rate_limit`

```bash
pnpm --filter @cx-orbit/webchat-provider dev
# listens on WEBCHAT_PROVIDER_PORT (default 9107)
```
