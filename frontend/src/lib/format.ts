export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function shortId(id: string, keep = 10): string {
  if (id.length <= keep) return id;
  return `${id.slice(0, keep)}…`;
}

export function statusTone(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'bg-teal-mist text-teal-deep';
    case 'WAITING_AGENT':
      return 'bg-signal-soft text-signal';
    case 'WAITING_CUSTOMER':
      return 'bg-ink/5 text-ink-soft';
    case 'WAITING_EXTERNAL_SERVICE':
      return 'bg-ink/5 text-ink-mute';
    case 'RESOLVED':
    case 'CLOSED':
      return 'bg-ok-soft text-ok';
    default:
      return 'bg-ink/5 text-ink-mute';
  }
}
