import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchConversations } from '../api/endpoints';
import { ErrorBanner } from '../components/ErrorBanner';
import { formatWhen, shortId, statusTone } from '../lib/format';
import { useUiStore } from '../store/ui';

const CHANNELS = ['', 'webchat', 'whatsapp', 'telegram', 'email', 'instagram', 'facebook', 'x'];
const STATUSES = [
  '',
  'OPEN',
  'WAITING_CUSTOMER',
  'WAITING_AGENT',
  'WAITING_EXTERNAL_SERVICE',
  'RESOLVED',
  'CLOSED',
];

export function ConversationsPage() {
  const channel = useUiStore((s) => s.conversationChannel);
  const status = useUiStore((s) => s.conversationStatus);
  const setFilters = useUiStore((s) => s.setConversationFilters);

  const query = useQuery({
    queryKey: ['conversations', channel, status],
    queryFn: () =>
      fetchConversations({
        page: 1,
        pageSize: 40,
        ...(channel ? { channel } : {}),
        ...(status ? { status } : {}),
      }),
    refetchInterval: 4_000,
  });

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Conversations</h1>
        <p className="mt-1 text-ink-mute">Lista en vivo desde conversation-service</p>
      </header>

      <div className="panel animate-rise flex flex-wrap gap-3 p-4">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-mute">
          Channel
          <select
            className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink"
            value={channel}
            onChange={(e) => setFilters(e.target.value, status)}
          >
            {CHANNELS.map((c) => (
              <option key={c || 'all'} value={c}>
                {c || 'all'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-mute">
          Status
          <select
            className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink"
            value={status}
            onChange={(e) => setFilters(channel, e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'all'}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto self-end font-mono text-xs text-ink-mute">
          {query.data ? `${query.data.pagination.total} total` : '…'}
        </div>
      </div>

      {query.isError ? (
        <ErrorBanner
          message={query.error instanceof Error ? query.error.message : 'Error'}
        />
      ) : null}

      <div className="panel animate-rise overflow-hidden">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-ink/[0.03] font-mono text-[11px] uppercase tracking-wider text-ink-mute">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Msgs</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-ink/8 hover:bg-teal-mist/20">
                <td className="px-4 py-3">
                  <Link
                    to={`/conversations/${c.id}`}
                    className="font-mono text-teal hover:underline"
                    title={c.id}
                  >
                    {shortId(c.id, 14)}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{c.channel}</td>
                <td className="px-4 py-3">
                  <span className={`chip ${statusTone(c.status)}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-ink-soft">{c.assignedTeam ?? '—'}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{c.messageCount}</td>
                <td className="px-4 py-3 text-ink-mute">{formatWhen(c.lastMessageAt)}</td>
              </tr>
            ))}
            {!query.isLoading && (query.data?.data.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-mute">
                  No hay conversaciones con estos filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
