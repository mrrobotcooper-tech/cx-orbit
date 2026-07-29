# WhatsApp provider fixtures

Inbound WhatsApp Cloud API payload builders for gateway contract tests and the
Phase 12 e2e pipeline (`tests/e2e`).

```ts
import { buildWhatsAppTextWebhook } from '@cx-orbit/whatsapp-provider';

const body = buildWhatsAppTextWebhook({ messageId: 'wamid.demo_1', text: 'hola' });
// POST body → http://localhost:8080/webhooks/whatsapp
```
