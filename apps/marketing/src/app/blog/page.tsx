import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/shared/PageShell';

export const metadata: Metadata = {
  title: 'Blog — Boss Nyumba',
  description:
    'Field notes from the East African property frontier. Product launches, M-Pesa integrations, regulatory changes, and lessons from real portfolios.',
};

interface Post {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly date: string;
  readonly tag: 'Product' | 'Field notes' | 'Engineering' | 'Policy';
}

const POSTS: ReadonlyArray<Post> = [
  {
    slug: 'mr-mwikila-canonical-launch',
    title: "Mr. Mwikila is now your AI Property Operations Manager",
    excerpt:
      "We have locked the canonical identity. One name, one title, one chat header across every Boss Nyumba surface. Here is why we did it and what it means for tenant trust.",
    date: '2026-05-22',
    tag: 'Product',
  },
  {
    slug: 'm-pesa-rent-collection-at-50-units',
    title: 'M-Pesa rent collection at 50 units: what we learned',
    excerpt:
      'Lessons from running rent collection over M-Pesa for a 53-unit portfolio in Kinondoni: reconciliation, dispute rates, and the one config we wish we had set on day one.',
    date: '2026-05-08',
    tag: 'Field notes',
  },
  {
    slug: 'autonomy-dial-for-property-managers',
    title: 'The autonomy dial for property managers',
    excerpt:
      'Five levels of autonomy, ten property domains. How we settled on the dial, and which level your portfolio should start at.',
    date: '2026-04-24',
    tag: 'Product',
  },
  {
    slug: 'append-only-rent-ledger',
    title: 'Why our rent ledger is append-only (and what that means for disputes)',
    excerpt:
      'The hash-chained audit invariant inside Boss Nyumba. How it survives phone changes, accountant turnover, and tenant-vs-landlord disputes.',
    date: '2026-04-09',
    tag: 'Engineering',
  },
  {
    slug: 'housing-regulator-evidence-pack',
    title: 'What an evidence-based housing regulator dashboard looks like',
    excerpt:
      'Live, anonymised, hash-chained district median rents. We built it for the regulator pilot. Here is the architecture.',
    date: '2026-03-27',
    tag: 'Policy',
  },
  {
    slug: 'swahili-first-product-decisions',
    title: 'Swahili-first product decisions we made (and a few we regret)',
    excerpt:
      'The case for defaulting to Swahili in the UI, the chat, and the receipts. The case against. And the design tradeoffs nobody talks about.',
    date: '2026-03-14',
    tag: 'Product',
  },
];

const TAG_TONE: Record<Post['tag'], string> = {
  Product: 'text-signal-500',
  'Field notes': 'text-emerald-400',
  Engineering: 'text-blue-400',
  Policy: 'text-amber-400',
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
          Subscribe to the RSS feed at{' '}
          <code className="font-mono text-sm text-signal-500">/blog/feed.xml</code>
          {' '}or follow{' '}
          <a
            href="https://x.com/bossnyumba"
            className="text-signal-500 hover:underline"
            rel="noopener noreferrer"
          >
            @bossnyumba
          </a>
          .
        </p>
      </div>
    </PageShell>
  );
}
