/**
 * Public blog post detail — /blog/[slug]
 */

import { getTranslations } from 'next-intl/server';
import { renderSafeMarkdown } from '@/lib/safe-markdown';

export const dynamic = 'force-dynamic';

interface PostData {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly bodyMd: string;
  readonly publishedAt: string | null;
  readonly tags: readonly string[];
}

async function loadPost(slug: string): Promise<PostData | null> {
  const base = process.env.BOSSNYUMBA_API_BASE ?? '';
  if (!base) return null;
  try {
    const res = await fetch(
      `${base}/api/v1/public/blog/${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as PostData;
  } catch {
    return null;
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getTranslations('blogPost');
  const resolvedParams = await params;
  const post = await loadPost(resolvedParams.slug);
  if (!post) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl">{t('notFound')}</h1>
        <p>
          <a href="/blog" className="text-blue-600 hover:underline">
            Back to blog
          </a>
        </p>
      </main>
    );
  }
  return (
    <main className="max-w-3xl mx-auto p-6">
      <nav className="mb-6">
        <a href="/blog" className="text-blue-600 hover:underline">
          &larr; Back to blog
        </a>
      </nav>
      <article
        className="prose prose-lg"
        dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(post.bodyMd) }}
      />
      {post.publishedAt ? (
        <p className="text-xs text-gray-400 mt-6">
          Published {new Date(post.publishedAt).toLocaleDateString()}
        </p>
      ) : null}
    </main>
  );
}
