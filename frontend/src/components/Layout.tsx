import { NavLink, Outlet } from 'react-router-dom';

const links: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/conversations', label: 'Conversations' },
  { to: '/incidents', label: 'Incidents' },
  { to: '/observability', label: 'Observability' },
];

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper-raised/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              CX-ORBIT
            </span>
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute sm:inline">
              Operator console
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                {...(link.end ? { end: true } : {})}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                    isActive
                      ? 'bg-ink text-paper-raised'
                      : 'text-ink-soft hover:bg-ink/5 hover:text-ink',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
