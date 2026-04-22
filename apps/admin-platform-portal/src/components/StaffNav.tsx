import Link from 'next/link';
import { cookies } from 'next/headers';
import { Logomark } from '@bossnyumba/design-system';
import { PLATFORM_SESSION_COOKIE } from '@/lib/session';

const NAV_ITEMS = [
  { href: '/industry', label: 'Industry dashboard' },
  { href: '/radar', label: 'Early-warning radar' },
  { href: '/insights', label: 'Cross-tenant insights' },
  { href: '/forecasts', label: 'Platform forecasts' },
] as const;

interface BudgetPayload {
  readonly remainingEpsilon?: number;
  readonly totalEpsilon?: number;
}

async function fetchBudget(cookieHeader: string): Promise<BudgetPayload | null> {
  try {
    const base = process.env.NEXT_PUBLIC_PLATFORM_PORTAL_BASE_URL ?? 'http://localhost:3020';
    const res = await fetch(`${base}/api/platform/budget`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as BudgetPayload;
    return data;
  } catch (error) {
    console.error('StaffNav budget fetch failed:', error);
    return null;
  }
}

export async function StaffNav() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const sessionPresent = Boolean(cookieStore.get(PLATFORM_SESSION_COOKIE)?.value);
  const budget = sessionPresent ? await fetchBudget(cookieHeader) : null;

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-surface-sunken min-h-screen flex flex-col">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <Logomark size={32} variant="premium" />
        <div className="flex flex-col">
          <span className="text-sm font-display text-foreground">BossNyumba</span>
          <span className="text-xs text-neutral-500 uppercase tracking-wider">HQ</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
          Privacy budget
        </div>
        {budget && typeof budget.remainingEpsilon === 'number' ? (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display text-signal-500">
              {budget.remainingEpsilon.toFixed(2)}
            </span>
            {typeof budget.totalEpsilon === 'number' && (
              <span className="text-xs text-neutral-500">
                of {budget.totalEpsilon.toFixed(2)} ε
              </span>
            )}
          </div>
        ) : (
          <div className="text-xs text-warning">
            Budget service offline
          </div>
        )}
      </div>
    </aside>
  );
}
