import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchIncidents, startIncident, stopAllIncidents, stopIncident } from '../api/endpoints';
import type { IncidentDefinition } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatWhen } from '../lib/format';

export function IncidentsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>('INC-002');
  const [duration, setDuration] = useState(60);

  const incidents = useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    refetchInterval: 2_000,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['incidents'] });
    await qc.invalidateQueries({ queryKey: ['analytics'] });
  };

  const startMut = useMutation({
    mutationFn: () =>
      startIncident({
        code: selected,
        ...(duration > 0 ? { durationSeconds: duration } : {}),
      }),
    onSuccess: invalidate,
  });

  const stopMut = useMutation({
    mutationFn: (id: string) => stopIncident(id),
    onSuccess: invalidate,
  });

  const stopAllMut = useMutation({
    mutationFn: stopAllIncidents,
    onSuccess: invalidate,
  });

  const catalog = incidents.data?.catalog ?? [];
  const active = incidents.data?.active ?? [];
  const def = catalog.find((c) => c.code === selected);

  return (
    <div className="space-y-6">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Incidents</h1>
          <p className="mt-1 text-ink-mute">Inyectá fallos controlados y observá el efecto</p>
        </div>
        {active.length > 0 ? (
          <button
            type="button"
            className="btn-danger"
            disabled={stopAllMut.isPending}
            onClick={() => stopAllMut.mutate()}
          >
            Stop all ({active.length})
          </button>
        ) : null}
      </header>

      {incidents.isError ? (
        <ErrorBanner
          message={incidents.error instanceof Error ? incidents.error.message : 'Error'}
        />
      ) : null}
      {startMut.isError ? (
        <ErrorBanner
          title="No se pudo iniciar"
          message={startMut.error instanceof Error ? startMut.error.message : 'Error'}
        />
      ) : null}

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="panel animate-rise space-y-3 p-4 lg:col-span-2">
          <h2 className="font-display text-lg font-bold">Catalog</h2>
          <ul className="space-y-2">
            {catalog.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  onClick={() => setSelected(item.code)}
                  className={[
                    'w-full rounded-xl border px-3 py-3 text-left transition',
                    selected === item.code
                      ? 'border-teal bg-teal-mist/50'
                      : 'border-ink/10 bg-white/60 hover:border-teal/30',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-teal">{item.code}</span>
                    {active.some((a) => a.code === item.code) ? (
                      <span className="chip bg-signal-soft text-signal">active</span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-semibold text-ink">{item.title}</p>
                  <p className="text-xs text-ink-mute">{item.theme}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel animate-rise space-y-4 p-5 lg:col-span-3">
          {def ? <IncidentDetail def={def} /> : <p className="text-ink-mute">Elegí un incidente</p>}

          <div className="flex flex-wrap items-end gap-3 border-t border-ink/10 pt-4">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-mute">
              Duration (s)
              <input
                type="number"
                min={0}
                className="w-28 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="btn-signal"
              disabled={startMut.isPending || !selected}
              onClick={() => startMut.mutate()}
            >
              {startMut.isPending ? 'Starting…' : `Start ${selected}`}
            </button>
            <p className="text-xs text-ink-mute">0 = sin auto-stop</p>
          </div>
        </div>
      </section>

      <section className="panel animate-rise p-5">
        <h2 className="font-display text-xl font-bold">Active</h2>
        {active.length === 0 ? (
          <p className="mt-3 text-sm text-ink-mute">Ningún incidente activo.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {active.map((a) => (
              <li
                key={a.incidentId}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-signal/30 bg-signal-soft/40 px-4 py-3"
              >
                <div>
                  <p className="font-mono text-xs text-signal">
                    {a.code} · {a.type}
                  </p>
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-xs text-ink-mute">
                    desde {formatWhen(a.startedAt)}
                    {a.durationSeconds ? ` · auto ${a.durationSeconds}s` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={stopMut.isPending}
                  onClick={() => stopMut.mutate(a.incidentId)}
                >
                  Stop
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function IncidentDetail({ def }: { def: IncidentDefinition }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-teal">{def.code}</p>
        <h2 className="font-display text-2xl font-bold">{def.title}</h2>
        <p className="text-sm text-ink-mute">{def.theme}</p>
      </div>
      <div>
        <h3 className="font-mono text-[11px] uppercase tracking-wide text-ink-mute">Symptoms</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {def.symptoms.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-mono text-[11px] uppercase tracking-wide text-ink-mute">Diagnosis</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {def.diagnosis.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <p className="font-mono text-xs text-ink-mute">{def.runbook}</p>
    </div>
  );
}
