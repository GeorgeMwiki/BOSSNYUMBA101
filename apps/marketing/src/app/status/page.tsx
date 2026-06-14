import type { Metadata } from 'next';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'System status — Boss Nyumba',
  description:
    'The services that make up the Boss Nyumba platform — API, owner cockpit, tenant mobile, Master Brain, mobile-money rails, audit chain, and notifications.',
};

/**
 * Static status page.
 *
 * NOTE: This page does NOT claim live SRE telemetry. A real-time status
 * board (`StatusBoard`) exists in `src/components/StatusBoard.tsx` and
 * polls `GET /api/v1/public/status`, but that gateway route is not yet
 * mounted. Until the public status endpoint ships we render an honest
 * static service catalogue rather than fabricating "all operational"
 * uptime numbers. When the endpoint lands, swap this page body for
 * `<StatusBoard locale={locale} />`.
 */

interface PlatformService {
  readonly name: string;
  readonly description: string;
}

const SERVICES: ReadonlyArray<PlatformService> = [
  { name: 'Owner web cockpit', description: 'Owner portal at app.bossnyumba.com' },
  { name: 'Tenant mobile', description: 'iOS and Android apps' },
  { name: 'API gateway', description: 'Public + partner API at api.bossnyumba.com' },
  { name: 'Master Brain', description: 'Mr. Mwikila reasoning + retrieval' },
  { name: 'M-Pesa connector', description: 'TZ + KE rent collection rail' },
  { name: 'Tigo Pesa connector', description: 'TZ rent collection rail' },
  { name: 'Airtel Money connector', description: 'TZ rent collection rail' },
  { name: 'Audit chain', description: 'Cryptographic append-only ledger' },
  { name: 'Notifications', description: 'SMS, push, email outbound' },
];

export default function StatusPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          Status
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Platform services.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/75">
          These are the services that make up Boss Nyumba. A live,
          real-time status board is on the way. For any active incident we
          email every affected customer directly and post updates on{' '}
          <a
            href="https://x.com/bossnyumba_ops"
            className="text-signal-500 hover:underline"
            rel="noopener noreferrer"
          >
            @bossnyumba_ops
          </a>
          .
        </p>

        <ul className="mt-10 divide-y divide-border rounded-2xl border border-border bg-surface">
          {SERVICES.map((service) => (
            <li
              key={service.name}
              className="flex items-center justify-between gap-4 px-6 py-4"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{service.name}</p>
                <p className="text-xs text-foreground/60">{service.description}</p>
              </div>
            </li>
          ))}
        </ul>

        <h2 className="mt-16 font-display text-xl font-semibold tracking-tight text-foreground">
          Reporting an issue
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/70">
          Seeing something wrong? Email{' '}
          <a
            href="mailto:support@bossnyumba.com"
            className="text-signal-500 hover:underline"
          >
            support@bossnyumba.com
          </a>{' '}
          and our team in Dar es Salaam will respond during EAT business
          hours.
        </p>
      </div>
    </PageShell>
  );
}
