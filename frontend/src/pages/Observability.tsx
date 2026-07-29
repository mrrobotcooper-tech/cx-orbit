import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchCircuit,
  fetchDlq,
  fetchIncidents,
  fetchSummary,
  probeHealth,
} from '../api/endpoints';
import { ErrorBanner } from '../components/ErrorBanner';
import { Stat } from '../components/Stat';
import { formatPct } from '../lib/format';

const SERVICES = [
  { name: 'conversation', base: '/svc/conversation' },
  { name: 'customer', base: '/svc/customer' },
  { name: 'ai', base: '/svc/ai' },
  { name: 'routing', base: '/svc/routing' },
  { name: 'outbound', base: '/svc/outbound' },
  { name: 'analytics', base: '/svc/analytics' },
  { name: 'incidents', base: '/svc/incidents' },
] as const;

export function ObservabilityPage() {
  const summary = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: fetchSummary,
    refetchInterval: 5_000,
  });
  const dlq = useQuery({
    queryKey: ['outbound', 'dlq'],
    queryFn: fetchDlq,
    refetchInterval: 5_000,
    retry: false,
  });
  const circuit = useQuery({
    queryKey: ['outbound', 'circuit', 'webchat'],
    queryFn: () => fetchCircuit('webchat'),
    refetchInterval: 5_000,
    retry: false,
  });
  const incidents = useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    refetchInterval: 5_000,
  });
  const health = useQuery({
    queryKey: ['health-probes'],
    queryFn: async () => {
      const entries = await Promise.all(
        SERVICES.map(async (s) => [s.name, await probeHealth(s.base)] as const),
      );
      return Object.fromEntries(entries) as Record<string, 'up' | 'down'>;
    },
    refetchInterval: 8_000,
  });

  const events = Object.entries(summary.data?.technical.eventsByType ?? {}).map(
    ([type, count]) => ({ type, count }),
  );
  const upCount = Object.values(health.data ?? {}).filter((v) => v === 'up').length;

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Observability</h1>
        <p className="mt-1 text-ink-mute">
          Salud de servicios, DLQ, breaker y stream — Grafana en{' '}
          <a
            className="font-semibold text-teal hover:underline"
            href="http://localhost:3001"
            target="_blank"
            rel="noreferrer"
          >
            :3001
          </a>
        </p>
      </header>

      {summary.isError ? (
        <ErrorBanner
          title="Analytics down"
          message={summary.error instanceof Error ? summary.error.message : 'Error'}
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Services up" value={`${upCount}/${SERVICES.length}`} tone="ok" />
        <Stat
          label="DLQ size"
          value={dlq.data?.size ?? (dlq.isError ? '—' : dlq.isLoading ? '…' : 0)}
          tone={(dlq.data?.size ?? 0) > 0 ? 'danger' : 'default'}
        />
        <Stat
          label="Webchat breaker"
          value={circuit.data?.state ?? (circuit.isError ? '—' : '…')}
          tone={circuit.data?.state === 'open' ? 'signal' : 'default'}
        />
        <Stat
          label="Active incidents"
          value={incidents.data?.active.length ?? 0}
          tone={(incidents.data?.active.length ?? 0) > 0 ? 'signal' : 'default'}
        />
      </section>

      <section className="panel animate-rise p-5">
        <h2 className="font-display text-xl font-bold">Service health</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => {
            const state = health.data?.[s.name] ?? 'down';
            return (
              <div
                key={s.name}
                className="flex items-center justify-between rounded-xl border border-ink/10 bg-white/70 px-3 py-2"
              >
                <span className="font-mono text-sm">{s.name}</span>
                <span
                  className={[
                    'chip',
                    state === 'up' ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger',
                  ].join(' ')}
                >
                  {state}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel animate-rise p-5">
          <h2 className="font-display text-xl font-bold">Pipeline rates</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Rate
              label="AI containment"
              value={
                summary.data ? formatPct(summary.data.business.aiContainmentRate) : '—'
              }
            />
            <Rate
              label="Handoff rate"
              value={summary.data ? formatPct(summary.data.business.handoffRate) : '—'}
            />
            <Rate
              label="Delivery success"
              value={
                summary.data ? formatPct(summary.data.business.deliverySuccessRate) : '—'
              }
            />
            <Rate
              label="Deliveries failed"
              value={String(summary.data?.technical.deliveriesFailed ?? '—')}
            />
          </dl>
        </div>

        <div className="panel animate-rise p-5">
          <h2 className="font-display text-xl font-bold">Events by type</h2>
          <div className="mt-2 h-64">
            {events.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-mute">
                Sin datos
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={events} layout="vertical" margin={{ left: 24, right: 8 }}>
                  <CartesianGrid stroke="rgba(12,27,42,0.08)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="type"
                    width={120}
                    tick={{ fontSize: 10, fill: '#5a6d7e' }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#d97706" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-ink/8 py-2">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-mono font-medium">{value}</dd>
    </div>
  );
}
