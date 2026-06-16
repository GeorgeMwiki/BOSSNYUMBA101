import type { Metadata } from 'next';
import { getLocale } from '@/lib/locale';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { ROLES, CAREERS_INBOX } from './roles';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kazi — BossNyumba',
      description:
        'Jenga mfumo wa uendeshaji wenye AI kwa ajili ya mali ya Afrika Mashariki. Tunaajiri katika uhandisi, bidhaa, AI, na shughuli za nyanjani. Dar es Salaam, Nairobi, na unaoruhusu kufanya kazi kwa mbali.',
    };
  }
  return {
    title: 'Careers — BossNyumba',
    description:
      'Build the AI operating system for East African real estate. Hiring across engineering, product, AI, and field operations. Dar es Salaam, Nairobi, remote-friendly.',
  };
}

export default function CareersPage() {
  const teams = Array.from(new Set(ROLES.map((r) => r.team)));
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">Careers</p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Build the OS for African real estate.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/75">
          We are East African, mission-led, and shipping the AI brain that replaces WhatsApp
          landlording. Headquartered in Dar es Salaam, with a hub in Nairobi and remote engineers
          across the EAT timezone band. We hire for craft, for context, and for the willingness to
          do the boring property-domain work that makes the magic possible.
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
                <li key={r.slug}>
                  <Link
                    href={`/careers/${r.slug}`}
                    className="group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-raised"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
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
            Email{' '}
            <a href={`mailto:${CAREERS_INBOX}`} className="text-signal-500 hover:underline">
              {CAREERS_INBOX}
            </a>{' '}
            with your CV and a one-paragraph note on what you would build here. We read every email.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
