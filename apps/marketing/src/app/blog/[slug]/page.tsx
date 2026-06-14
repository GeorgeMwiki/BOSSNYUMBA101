import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { POSTS, TAG_TONE, getPostBySlug } from '../posts';

/**
 * /blog/[slug] — renders a single post from the same `POSTS` source the
 * index lists, so every link the index shows resolves to real content.
 * Unknown slugs fall through to the marketing 404 via `notFound()`.
 */

interface BlogPostParams {
  readonly slug: string;
}

export function generateStaticParams(): ReadonlyArray<BlogPostParams> {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<BlogPostParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) {
    return { title: 'Post not found — Boss Nyumba' };
  }
  return {
    title: `${post.title} — Boss Nyumba`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({
  params,
}: {
  readonly params: Promise<BlogPostParams>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-20 lg:px-8">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-foreground/60 transition-colors hover:text-signal-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All posts
        </Link>

        <div className="mt-8 flex items-baseline justify-between gap-4">
          <p className={`font-mono text-[0.65rem] uppercase tracking-widest ${TAG_TONE[post.tag]}`}>
            {post.tag}
          </p>
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-foreground/60 tabular-nums">
            {post.date} · {post.readingMinutes} min read
          </p>
        </div>

        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground/75">
          {post.excerpt}
        </p>

        <div className="mt-10 space-y-6 border-t border-border pt-10">
          {post.body.map((paragraph, index) => (
            <p
              key={index}
              className="text-base leading-relaxed text-foreground/80"
            >
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Run your portfolio on Boss Nyumba.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Leases, rent, maintenance, and treasury on one calm brain.
          </p>
          <Link
            href="/sign-up"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-signal-500 px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-signal-400"
          >
            Get started
          </Link>
        </div>
      </article>
    </PageShell>
  );
}
