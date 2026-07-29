import { buildWebchatApp } from './app.js';

const port = Number(process.env.WEBCHAT_PROVIDER_PORT ?? 9107);
const host = process.env.HOST ?? '0.0.0.0';

const { app } = await buildWebchatApp();
await app.listen({ host, port });
console.error(`webchat-provider listening on ${port}`);
