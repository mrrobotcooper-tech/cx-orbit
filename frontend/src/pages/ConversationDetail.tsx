import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  analyzeText,
  fetchConversation,
  fetchCustomer,
  fetchRoutingDecisions,
  resolveConversation,
} from '../api/endpoints';
import { ApiError } from '../api/client';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatWhen, statusTone } from '../lib/format';
import { useUiStore } from '../store/ui';

export function ConversationDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const analysis = useUiStore((s) => s.analysisByConversation[id]);
  const setAnalysis = useUiStore((s) => s.setAnalysis);

  const detail = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => fetchConversation(id),
    enabled: Boolean(id),
    refetchInterval: 3_000,
  });

  const routing = useQuery({
    queryKey: ['routing', id],
    queryFn: () => fetchRoutingDecisions(id),
    enabled: Boolean(id),
    retry: false,
  });

  const customerId = detail.data?.conversation.customerId;
  const customer = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => fetchCustomer(customerId!),
    enabled: Boolean(customerId),
    retry: false,
  });

  const resolveMut = useMutation({
    mutationFn: () => resolveConversation(id, 'agent'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['conversation', id] });
      await qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const analyzeMut = useMutation({
    mutationFn: async () => {
      const messages = detail.data?.messages ?? [];
      const inbound = [...messages].reverse().find((m) => m.direction === 'inbound');
      const text = inbound?.content.text?.trim();
      if (!text) throw new Error('No hay texto inbound para analizar');
      return analyzeText({
        text,
        conversationId: id,
        ...(inbound ? { messageId: inbound.id } : {}),
      });
    },
    onSuccess: (result) => setAnalysis(id, result),
  });

  const conv = detail.data?.conversation;
  const messages = detail.data?.messages ?? [];
  const decisions = routing.data?.data ?? [];
  const latestDecision = decisions[0];

  return (
    <div className="space-y-6">
      <div className="animate-rise flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/conversations" className="text-sm font-semibold text-teal hover:underline">
            ← Conversations
          </Link>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Conversation</h1>
          <p className="mt-1 font-mono text-xs text-ink-mute break-all">{id}</p>
        </div>
        {conv && conv.status !== 'RESOLVED' && conv.status !== 'CLOSED' ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={resolveMut.isPending}
            onClick={() => resolveMut.mutate()}
          >
            Resolver
          </button>
        ) : null}
      </div>

      {detail.isError ? (
        <ErrorBanner
          message={detail.error instanceof Error ? detail.error.message : 'Error'}
        />
      ) : null}

      {conv ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="panel animate-rise space-y-3 p-5 lg:col-span-1">
            <h2 className="font-display text-lg font-bold">Estado</h2>
            <Row label="Channel" value={conv.channel} />
            <Row
              label="Status"
              value={<span className={`chip ${statusTone(conv.status)}`}>{conv.status}</span>}
            />
            <Row label="Priority" value={conv.priority ?? '—'} />
            <Row label="Team" value={conv.assignedTeam ?? '—'} />
            <Row label="Messages" value={conv.messageCount} />
            <Row label="Updated" value={formatWhen(conv.updatedAt)} />
            {customer.data?.customer ? (
              <Row
                label="Customer"
                value={customer.data.customer.displayName ?? customer.data.customer.id}
              />
            ) : null}
          </div>

          <div className="panel animate-rise space-y-3 p-5 lg:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">AI analysis</h2>
              <button
                type="button"
                className="btn-primary"
                disabled={analyzeMut.isPending || messages.length === 0}
                onClick={() => analyzeMut.mutate()}
              >
                {analyzeMut.isPending ? 'Analizando…' : 'Analizar'}
              </button>
            </div>
            <p className="text-xs text-ink-mute">
              No hay GET histórico de AI; se re-analiza el último inbound vía POST /analyze.
            </p>
            {analyzeMut.isError ? (
              <ErrorBanner
                message={
                  analyzeMut.error instanceof Error ? analyzeMut.error.message : 'Analyze failed'
                }
              />
            ) : null}
            {analysis ? (
              <div className="space-y-2 rounded-xl bg-ink/[0.03] p-3 text-sm">
                <Row label="Status" value={analysis.status} />
                <Row label="Intent" value={analysis.intent ?? '—'} />
                <Row label="Sentiment" value={analysis.sentiment ?? '—'} />
                <Row
                  label="Confidence"
                  value={
                    analysis.confidence !== undefined ? analysis.confidence.toFixed(2) : '—'
                  }
                />
                <Row label="Fallback" value={analysis.usedFallback ? 'yes' : 'no'} />
                {analysis.summary ? <Row label="Summary" value={analysis.summary} /> : null}
              </div>
            ) : (
              <p className="text-sm text-ink-mute">Sin análisis en esta sesión todavía.</p>
            )}
          </div>

          <div className="panel animate-rise space-y-3 p-5 lg:col-span-1">
            <h2 className="font-display text-lg font-bold">Routing</h2>
            {routing.isError ? (
              <p className="text-sm text-ink-mute">
                {routing.error instanceof ApiError && routing.error.status === 404
                  ? 'Sin decisiones de routing aún.'
                  : routing.error instanceof Error
                    ? routing.error.message
                    : 'Error'}
              </p>
            ) : null}
            {latestDecision ? (
              <div className="space-y-2 text-sm">
                <Row label="Team" value={latestDecision.assignedTeam} />
                <Row label="Priority" value={latestDecision.priority} />
                <Row
                  label="Handoff"
                  value={
                    latestDecision.handoffToHuman
                      ? latestDecision.handoffReason ?? 'yes'
                      : 'no'
                  }
                />
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-ink-mute">
                    Reasons
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
                    {latestDecision.reason.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : !routing.isError ? (
              <p className="text-sm text-ink-mute">Esperando routing.completed…</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel animate-rise p-5">
        <h2 className="font-display text-xl font-bold">Timeline</h2>
        <p className="mb-4 text-sm text-ink-mute">Mensajes inbound / outbound</p>
        <ol className="space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={[
                'rounded-xl border px-4 py-3',
                m.direction === 'inbound'
                  ? 'border-teal/20 bg-teal-mist/30'
                  : 'border-ink/10 bg-white/70',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="chip bg-ink/5 text-ink-soft">{m.direction}</span>
                <span className="font-mono text-[11px] text-ink-mute">
                  {formatWhen(m.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink">
                {m.content.text ?? m.content.caption ?? m.content.type}
              </p>
              <p className="mt-1 font-mono text-[11px] text-ink-mute">
                {m.sender.displayName ?? m.sender.externalId}
              </p>
            </li>
          ))}
          {!detail.isLoading && messages.length === 0 ? (
            <li className="py-6 text-center text-sm text-ink-mute">Sin mensajes</li>
          ) : null}
        </ol>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-mute">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
