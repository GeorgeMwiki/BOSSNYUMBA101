import Link from 'next/link';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  ArrowUpRight,
  CheckCircle,
} from 'lucide-react';
import { PageShell } from '@/components/migrated/PageShell';
import { LiveDataRequiredPanel } from '@/components/migrated/LiveDataRequiredPanel';

/**
 * Platform Overview — migrated from
 * apps/admin-portal/src/app/platform/overview/page.tsx.
 *
 * The legacy version rendered hardcoded mock revenue/tenant-growth
 * series via recharts. admin-platform-portal does not ship recharts as
 * a dependency, and HQ surfaces are required to render only from live
 * aggregates. Until /api/platform/overview/{revenue, tenants} are
 * wired, the trend section degrades honestly. The KPI cards still
 * render the static shape so navigation remains functional.
 */

const QUICK_LINKS = [
  {
    href: '/platform/subscriptions',
    label: 'Subscriptions',
    icon: CheckCircle,
  },
  { href: '/platform/billing', label: 'Billing', icon: CreditCard },
  { href: '/feature-flags', label: 'Feature flags', icon: Activity },
  { href: '/industry', label: 'Industry dashboard', icon: Building2 },
] as const;

export default function PlatformOverviewPage() {
  return (
    <PageShell
      title="Platform overview"
      subtitle="Sector-wide KPIs across every BossNyumba tenant. Live numbers only — no mock data."
    >
      <div className="space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Building2}
            label="Active tenants"
            badge={
              <span className="flex items-center gap-1 text-sm text-emerald-400">
                <TrendingUp className="h-4 w-4" />
                Live
              </span>
            }
          />
          <KpiCard icon={Users} label="Platform users" />
          <KpiCard icon={CreditCard} label="Monthly revenue" />
          <KpiCard icon={Activity} label="Units managed" />
        </section>

        <LiveDataRequiredPanel
          feature="Revenue & tenant trend charts"
          description="Trend charts render only when /api/platform/overview/{revenue, tenants} report calibrated time-series. The legacy mocked recharts panels were removed."
        />

        <div className="platform-card">
          <h3 className="mb-4 font-display text-foreground">Quick actions</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-signal-500/40 hover:bg-surface"
              >
                <Icon className="h-5 w-5 text-signal-500" />
                <span className="text-sm font-medium text-foreground">
                  {label}
                </span>
                <ArrowUpRight className="ml-auto h-4 w-4 text-neutral-500" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

interface KpiCardProps {
  readonly icon: typeof Building2;
  readonly label: string;
  readonly badge?: React.ReactNode;
}

function KpiCard({ icon: Icon, label, badge }: KpiCardProps) {
  return (
    <div className="platform-card">
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-signal-500/10 p-2">
          <Icon className="h-5 w-5 text-signal-500" />
        </div>
        {badge}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-display text-neutral-500">—</p>
        <p className="text-sm text-neutral-400">{label}</p>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Awaiting live aggregate</p>
    </div>
  );
}
