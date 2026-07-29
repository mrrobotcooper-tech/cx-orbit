import { apiFetch } from './client';
import type {
  ActiveIncident,
  AnalyticsSummary,
  AnalyzeResult,
  CircuitResponse,
  Conversation,
  Customer,
  DlqResponse,
  IncidentsResponse,
  Message,
  Pagination,
  RoutingDecision,
} from './types';

export function fetchSummary() {
  return apiFetch<AnalyticsSummary>('/svc/analytics/summary');
}

export function fetchConversations(params: {
  page?: number;
  pageSize?: number;
  channel?: string;
  status?: string;
}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.channel) qs.set('channel', params.channel);
  if (params.status) qs.set('status', params.status);
  const q = qs.toString();
  return apiFetch<{ data: Conversation[]; pagination: Pagination }>(
    `/svc/conversation/conversations${q ? `?${q}` : ''}`,
  );
}

export function fetchConversation(id: string) {
  return apiFetch<{ conversation: Conversation; messages: Message[] }>(
    `/svc/conversation/conversations/${encodeURIComponent(id)}`,
  );
}

export function resolveConversation(id: string, resolvedBy: 'bot' | 'agent' = 'agent') {
  return apiFetch<{ status: string; conversationId: string }>(
    `/svc/conversation/conversations/${encodeURIComponent(id)}/resolve`,
    { method: 'POST', body: JSON.stringify({ resolvedBy }) },
  );
}

export function fetchCustomer(id: string) {
  return apiFetch<{ customer: Customer }>(`/svc/customer/customers/${encodeURIComponent(id)}`);
}

export function fetchRoutingDecisions(conversationId: string) {
  return apiFetch<{ data: RoutingDecision[] }>(
    `/svc/routing/routing/decisions/${encodeURIComponent(conversationId)}`,
  );
}

export function analyzeText(input: {
  text: string;
  conversationId: string;
  messageId?: string;
}) {
  return apiFetch<AnalyzeResult>('/svc/ai/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchIncidents() {
  return apiFetch<IncidentsResponse>('/svc/incidents/incidents');
}

export function startIncident(body: {
  code?: string;
  type?: string;
  durationSeconds?: number;
  params?: Record<string, unknown>;
}) {
  return apiFetch<ActiveIncident>('/svc/incidents/incidents/start', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function stopIncident(id: string) {
  return apiFetch<{ stopped: boolean; incident: ActiveIncident }>(
    `/svc/incidents/incidents/${encodeURIComponent(id)}/stop`,
    { method: 'POST' },
  );
}

export function stopAllIncidents() {
  return apiFetch<{ stopped: number; incidents: ActiveIncident[] }>(
    '/svc/incidents/incidents/stop-all',
    { method: 'POST' },
  );
}

export function fetchDlq() {
  return apiFetch<DlqResponse>('/svc/outbound/dlq');
}

export function fetchCircuit(channel: string) {
  return apiFetch<CircuitResponse>(`/svc/outbound/circuits/${encodeURIComponent(channel)}`);
}

export async function probeHealth(base: string): Promise<'up' | 'down'> {
  try {
    const res = await fetch(`${base}/health`);
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}
