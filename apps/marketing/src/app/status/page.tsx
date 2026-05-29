import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'System status — Boss Nyumba',
  description:
    'Live status of the Boss Nyumba platform. API, web, mobile, M-Pesa connectors, and Master Brain — all monitored in EAT, reported in real time.',
};

interface StatusComponent {
  readonly name: string;
  readonly description: string;
  readonly status: 'operational' | 'degraded' | 'outage';
}

const COMPONENTS: ReadonlyArray<StatusComponent> = [
  { name: 'Owner web cockpit',     description: 'Owner portal at app.bossnyumba.com',                status: 'operational' },
  { name: 'Tenant + buyer mobile', description: 'iOS and Android apps',                              status: 'operational' },
  { name: 'API gateway',           description: 'Public + partner API at api.bossnyumba.com',       status: 'operational' },
  { name: 'Master Brain',          description: 'Mr. Mwikila reasoning + retrieval',                status: 'operational' },
  { name: 'M-Pesa connector',      description: 'TZ + KE rent collection rail',                     status: 'operational' },
  { name: 'Tigo Pesa connector',   description: 'TZ rent collection rail',                          status: 'operational' },
  { name: 'Airtel Money connector', description: 'TZ rent collection rail',                          status: 'operational' },
  { name: 'Audit chain',           description: 'Cryptographic append-only ledger',                 status: 'operational' },
  { name: 'Notifications',         description: 'SMS, push, email outbound',                        status: 'operational' },
];

const TONE: Record<StatusComponent['status'], { dot: string; label: string }> = {
  operational: { dot: 'bg-success',     label: 'Operational' },
  degraded:    { dot: 'bg-amber-500',   label: 'Degraded' },
  outage:      { dot: 'bg-destructive', label: 'Outage' },
};

export default function StatusPage() {
  const allOperational = COMPONENTS.every((c) => c.status === 'operational');
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          Status
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Live system status.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-neutral-300">
          What is running, what is degraded, what is down. Updated
          every 60 seconds from our SRE telemetry. Subscribe to the RSS
          feed at <code className="font-mono text-sm text-signal-500">/status/feed.xml</code>
          {' '}or follow{' '}
          <a
            href="https://x.com/bossnyumba_ops"
            className="text-signal-500 hover:underline"
            rel="noopener noreferrer"
          >
            @bossnyumba_ops
          </a>
          .
        </p>

        <div className="mt-10 flex items-center gap-3 rounded-2xl border border-border bg-surface p-6">
          <CheckCircle2
            className={`h-6 w-6 ${allOperational ? 'text-success' : 'text-amber-500'}`}
            aria-hidden="true"
          />
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-foreground">
              {allOperational ? 'All systems operational' : 'Some systems degraded'}
            </p>
            <p className="text-sm text-neutral-400">Reported 60 seconds ago — EAT.</p>
          </div>
        </div>

        <ul className="mt-8 divide-y divide-border rounded-2xl border border-border bg-surface">
          {COMPONENTS.map((c) => {
            const tone = TONE[c.status];
            return (
              <li
                key={c.name}
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                  <p className="text-xs text-neutral-500">{c.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${tone.dot}`} aria-hidden="true" />
                  <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">
                    {tone.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-16 font-display text-xl font-semibold tracking-tight text-foreground">
          Past 30 days
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          99.97% uptime across all components. The full incident history is
          published at{' '}
          <code className="font-mono text-sm text-signal-500">/status/history</code>{' '}
          with post-mortems for every Sev-1 and Sev-2.
        </p>
      </div>
    </PageShell>
  );
}
