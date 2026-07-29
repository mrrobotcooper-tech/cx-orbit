interface StatProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'ok' | 'signal' | 'danger';
}

export function Stat({ label, value, hint, tone = 'default' }: StatProps) {
  const valueTone =
    tone === 'ok'
      ? 'text-ok'
      : tone === 'signal'
        ? 'text-signal'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-ink';

  return (
    <div className="panel animate-rise p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold tabular-nums ${valueTone}`}>{value}</p>
      {hint ? <p className="mt-1 text-sm text-ink-mute">{hint}</p> : null}
    </div>
  );
}
