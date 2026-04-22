import Link from 'next/link';
import { Wordmark } from '@bossnyumba/design-system';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-sunken">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_3fr]">
          {/* Left: brand block */}
          <div>
            <Wordmark size="md" premium />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-neutral-500">
              The autonomous operating system for property portfolios.
              Calm intelligence. Institutional trust.
            </p>
            <p className="mt-8 font-mono text-[0.65rem] uppercase tracking-widest text-neutral-600">
              Nairobi · London · Dubai · Singapore
            </p>
          </div>

          {/* Right: link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              {
                title: 'Platform',
                links: ['Autonomy', 'Head Briefing', 'Orchestrators', 'Audit trail', 'Integrations'],
              },
              {
                title: 'Company',
                links: ['About', 'Careers', 'Press', 'Customers', 'Changelog'],
              },
              {
                title: 'Resources',
                links: ['Docs', 'API reference', 'Security', 'Trust centre', 'Status'],
              },
              {
                title: 'Legal',
                links: ['Terms', 'Privacy', 'DPA', 'Subprocessors', 'Acceptable use'],
              },
            ].map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h3 className="font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500">
                  {col.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}>
                      <Link
                        href={`/${col.title.toLowerCase()}/${l.toLowerCase().replace(/\s+/g, '-')}`}
                        className="text-sm text-neutral-500 transition-colors duration-fast hover:text-foreground"
                      >
                        {l}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 sm:flex-row sm:items-center">
          <p className="font-mono text-[0.68rem] text-neutral-500">
            © 2026 Boss Nyumba. All rights reserved.
          </p>
          <div className="flex items-center gap-4 font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> All systems operational
            </span>
            <span className="h-3 w-px bg-border" />
            <span>SOC 2 Type II</span>
            <span className="h-3 w-px bg-border" />
            <span>ISO 27001</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
