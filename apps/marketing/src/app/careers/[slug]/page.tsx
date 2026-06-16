import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { ROLES, CAREERS_INBOX, getRoleBySlug } from '../roles';

/**
 * /careers/[slug] — renders a single role from the same `ROLES` source
 * the index lists, so every "Apply" link resolves to a real role page.
 * The apply path is a prefilled email to the careers inbox (the genuine
 * application channel); unknown slugs fall through to the 404.
 */

interface RoleParams {
  readonly slug: string;
}

// Next.js' generated route-type validator requires a mutable
// `Params[]` (or `Promise<Params[]>`); a `readonly`/`ReadonlyArray`
// return is rejected at build time. `.map` already yields a fresh
// array, so this stays a non-mutating, allocate-new return.
export function generateStaticParams(): RoleParams[] {
  return ROLES.map((role) => ({ slug: role.slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<RoleParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const role = getRoleBySlug(slug);
  if (!role) {
    return { title: 'Role not found — BossNyumba' };
  }
  return {
    title: `${role.title} — Careers — BossNyumba`,
    description: role.summary,
  };
}

function buildApplyHref(roleTitle: string): string {
  const subject = encodeURIComponent(`Application: ${roleTitle}`);
  const body = encodeURIComponent(
    `Hi BossNyumba team,\n\nI would like to apply for the ${roleTitle} role. My CV is attached.\n\nWhat I would build here:\n\n`,
  );
  return `mailto:${CAREERS_INBOX}?subject=${subject}&body=${body}`;
}

export default async function RolePage({
  params,
}: {
  readonly params: Promise<RoleParams>;
}) {
  const { slug } = await params;
  const role = getRoleBySlug(slug);
  if (!role) notFound();

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-20 lg:px-8">
        <Link
          href="/careers"
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-foreground/60 transition-colors hover:text-signal-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All roles
        </Link>

        <p className="mt-8 font-mono text-xs uppercase tracking-widest text-signal-500">
          {role.team}
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          {role.title}
        </h1>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-foreground/60">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {role.location} · {role.type}
        </p>

        <p className="mt-6 text-lg leading-relaxed text-foreground/75">
          {role.summary}
        </p>

        <a
          href={buildApplyHref(role.title)}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-signal-500 px-6 text-sm font-semibold text-primary-foreground transition-all hover:bg-signal-400"
        >
          Apply for this role
        </a>

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            What you will do
          </h2>
          <ul className="mt-4 space-y-2">
            {role.responsibilities.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-relaxed text-foreground/80"
              >
                <span
                  className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-signal-500"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            What we are looking for
          </h2>
          <ul className="mt-4 space-y-2">
            {role.requirements.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-relaxed text-foreground/80"
              >
                <span
                  className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-signal-500"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-16 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Ready to apply?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Send your CV and a one-paragraph note on what you would build
            here to{' '}
            <a
              href={buildApplyHref(role.title)}
              className="text-signal-500 hover:underline"
            >
              {CAREERS_INBOX}
            </a>
            . We read every email.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
