import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shared/PageShell';
import { POSTS, TAG_TONE } from './posts';

export const metadata: Metadata = {
  title: 'Blog — Boss Nyumba',
  description:
    'Field notes from the East African property frontier. Product launches, M-Pesa integrations, regulatory changes, and lessons from real portfolios.',
};

export default function BlogIndexPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-20 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-signal-500">
          Blog
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Field notes from the property frontier.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/75">
          Product launches, M-Pesa integrations, regulatory changes, and
          lessons from real portfolios in Tanzania and Kenya.
        </p>

        <ul className="mt-12 divide-y divide-border rounded-2xl border border-border bg-surface">
          {POSTS.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block px-6 py-6 transition-colors hover:bg-surface-raised"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <p className={`font-mono text-[0.65rem] uppercase tracking-widest ${TAG_TONE[post.tag]}`}>
                    {post.tag}
                  </p>
                  <p className="font-mono text-[0.65rem] uppercase tracking-widest text-foreground/60 tabular-nums">
                    {post.date}
                  </p>
                </div>
                <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-signal-500">
                  {post.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                  {post.excerpt}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-sm text-foreground/60">
          Follow{' '}
          <a
            href="https://x.com/bossnyumba"
            className="text-signal-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            @bossnyumba
          </a>{' '}
          for new posts.
        </p>
      </div>
    </PageShell>
  );
}
