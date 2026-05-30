import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'Careers — Boss Nyumba',
  description:
    "Build the AI operating system for East African real estate. Hiring across engineering, product, AI, and field operations. Dar es Salaam, Nairobi, remote-friendly.",
};

interface Role {
  readonly title: string;
  readonly team: string;
  readonly location: string;
  readonly type: string;
}

const ROLES: ReadonlyArray<Role> = [
  { title: 'Senior backend engineer (Hono + Drizzle)',  team: 'Platform',  location: 'Dar es Salaam · Hybrid', type: 'Full-time' },
  { title: 'Senior frontend engineer (Next + Vite)',    team: 'Product',   location: 'Dar es Salaam · Hybrid', type: 'Full-time' },
  { title: 'AI engineer — Master Brain + LMBM',         team: 'AI',        location: 'Remote (EAT ±3h)',       type: 'Full-time' },
  { title: 'Mobile engineer (Expo / React Native)',     team: 'Mobile',    location: 'Nairobi · Hybrid',       type: 'Full-time' },
  { title: 'Solutions architect (property domain)',     team: 'Solutions', location: 'Dar es Salaam · On-site', type: 'Full-time' },
  { title: 'Customer success manager — Tanzania',       team: 'Success',   location: 'Dar es Salaam · On-site', type: 'Full-time' },
  { title: 'Customer success manager — Kenya',          team: 'Success',   location: 'Nairobi · On-site',       type: 'Full-time' },
  { title: 'SRE / DevOps engineer',                     team: 'Platform',  location: 'Remote (EAT ±3h)',       type: 'Full-time' },
  { title: 'Designer (product + brand)',                team: 'Product',   location: 'Remote (EAT ±5h)',       type: 'Full-time' },
];

export default function CareersPage() {
  const teams = Array.from(new Set(ROLES.map((r) => r.team)));
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          Careers
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Build the OS for African real estate.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/75">
          We are East African, mission-led, and shipping the AI brain that
          replaces WhatsApp landlording. Headquartered in Dar es Salaam,
          with a hub in Nairobi and remote engineers across the EAT
          timezone band. We hire for craft, for context, and for the
          willingness to do the boring property-domain work that makes
          the magic possible.
        </p>

        <p className="mt-10 font-mono text-xs uppercase tracking-widest text-foreground/60">
          Open roles
        </p>
        {teams.map((team) => (
          <section key={team} className="mt-6">
            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
              {team}
            </h2>
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
              {ROLES.filter((r) => r.team === team).map((r) => (
                <li key={r.title}>
                  <Link
                    href={`/careers/${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className="group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-raised"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {r.title}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-foreground/60">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {r.location} · {r.type}
                      </p>
                    </div>
                    <span className="font-mono text-xs uppercase tracking-widest text-signal-500 opacity-0 transition-opacity group-hover:opacity-100">
                      Apply
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="mt-16 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Don&apos;t see your role?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Email careers@bossnyumba.com with your CV and a one-paragraph
            note on what you would build here. We read every email.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
