export const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:8080';
export const ANALYTICS_URL = process.env.ANALYTICS_URL ?? 'http://localhost:8086';
export const CONVERSATION_URL = process.env.CONVERSATION_URL ?? 'http://localhost:8081';
export const INCIDENTS_URL = process.env.INCIDENTS_URL ?? 'http://localhost:8087';

export interface AnalyticsSummary {
  business: {
    messagesInbound: number;
    conversationsCreated: number;
    aiAnalyses: number;
    routingDecisions: number;
  };
}

export async function fetchSummary(): Promise<AnalyticsSummary> {
  const res = await fetch(`${ANALYTICS_URL}/summary`);
  if (!res.ok) throw new Error(`analytics /summary → ${res.status}`);
  return (await res.json()) as AnalyticsSummary;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function waitFor(
  predicate: () => Promise<boolean>,
  options: { timeoutMs?: number; intervalMs?: number; label?: string } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 1_000;
  const label = options.label ?? 'condition';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label} (${timeoutMs}ms)`);
}

export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}
