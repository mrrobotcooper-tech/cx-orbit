import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchIncidents, fetchSummary } from '../api/endpoints';
import { ErrorBanner } from '../components/ErrorBanner';
import { Stat } from '../components/Stat';
import { formatPct } from '../lib/format';

export function DashboardPage() {
  const summary = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: fetchSummary,
    refetchInterval: 5_000,
  });
  const incidents = useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    refetchInterval: 5_000,
  });

  const biz = summary.data?.business;
  const tech = summary.data?.technical;
  const eventRows = Object.entries(tech?.eventsByType ?? {})
    .map(([type, count]) => ({ type: type.replace(/^.*\./, ''), full: type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const activeCount = incidents.data?.active.length ?? 0;

  return (
    <div className="space-y-8">
      <section className="animate-rise relative overflow-hidden rounded-3xl border border-ink/10 bg-gradient-to-br from-ink via-ink-soft to-teal-deep px-6 py-10 text-paper-raised sm:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(197,228,229,0.35), transparent 40%), radial-gradient(circle at 80% 0%, rgba(217,119,6,0.25), transparent 35%)',
          }}
        />
        <div className="relative max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-teal-mist">Live lab</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            CX-ORBIT
          </h1>
          <p className="mt-3 text-base text-paper/85 sm:text-lg">
            Consola de operador sobre el contact center multicanal — métricas en vivo, conversaciones
            y fallos controlados.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/conversations" className="btn-primary bg-paper-raised text-ink hover:bg-white">
              Ver conversaciones
            </Link>
            <Link to="/incidents" className="btn-ghost border-white/25 bg-white/10 text-paper-raised hover:bg-white/20">
              Inyectar incidente
            </Link>
          </div>
        </div>
      </section>

      {summary.isError ? (
        <ErrorBanner
          title="Analytics no disponible"
          message={summary.error instanceof Error ? summary.error.message : 'Error desconocido'}
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Inbound"
          value={biz?.messagesInbound ?? (summary.isLoading ? '…' : 0)}
          hint="message.received"
        />
        <Stat
          label="Conversaciones"
          value={biz?.conversationsCreated ?? (summary.isLoading ? '…' : 0)}
          hint={`${biz?.conversationsResolved ?? 0} resueltas`}
        />
        <Stat
          label="AI containment"
          value={biz ? formatPct(biz.aiContainmentRate) : summary.isLoading ? '…' : '—'}
          tone="ok"
          hint={`${biz?.aiAnalyses ?? 0} análisis`}
        />
        <Stat
          label="Incidents active"
          value={incidents.isLoading ? '…' : activeCount}
          tone={activeCount > 0 ? 'signal' : 'default'}
          hint={activeCount > 0 ? 'Hay fallos inyectados' : 'Sistema en baseline'}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel animate-rise p-5 lg:col-span-2">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Event stream</h2>
              <p className="text-sm text-ink-mute">Top tipos vistos por analytics-service</p>
            </div>
            <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-mute">
              <span className="inline-block h-2 w-2 animate-pulse-dot rounded-full bg-ok" />
              poll 5s
            </span>
          </div>
          <div className="h-64 w-full">
            {eventRows.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-mute">
                Sin eventos aún — enviá un webhook o arrancá un incidente.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventRows} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                  <CartesianGrid stroke="rgba(12,27,42,0.08)" vertical={false} />
                  <XAxis
                    dataKey="type"
                    tick={{ fill: '#5a6d7e', fontSize: 11 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: '#5a6d7e', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid rgba(12,27,42,0.1)',
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [value, 'count']}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { full?: string } | undefined;
                      return row?.full ?? '';
                    }}
                  />
                  <Bar dataKey="count" fill="#0d7377" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel animate-rise space-y-4 p-5">
          <div>
            <h2 className="font-display text-xl font-bold">Rates</h2>
            <p className="text-sm text-ink-mute">Salud del pipeline</p>
          </div>
          <RateRow label="Handoff" value={biz ? formatPct(biz.handoffRate) : '—'} />
          <RateRow
            label="Delivery success"
            value={biz ? formatPct(biz.deliverySuccessRate) : '—'}
          />
          <RateRow label="AI low confidence" value={String(tech?.aiLowConfidence ?? 0)} />
          <RateRow label="Deliveries failed" value={String(tech?.deliveriesFailed ?? 0)} />
          <RateRow label="Routing handoffs" value={String(tech?.routingHandoffs ?? 0)} />
        </div>
      </section>
    </div>
  );
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink/8 py-2 last:border-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="font-mono text-sm font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}
