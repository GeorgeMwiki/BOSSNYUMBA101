/**
 * Public blog post detail — /blog/[slug]
 */

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

function renderMarkdownBasic(md: string): string {
  // Intentionally lightweight — server components render HTML.
  return md
    .replace(/^# (.*)$/gm, '<h1 class="text-3xl font-semibold mt-6">$1</h1>')
    .replace(/^## (.*)$/gm, '<h2 class="text-2xl font-semibold mt-6">$1</h2>')
    .replace(/\n\n/g, '</p><p class="my-3">')
    .replace(/^/, '<p class="my-3">')
    .replace(/$/, '</p>');
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const post = await loadPost(resolvedParams.slug);
  if (!post) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl">Post not found</h1>
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
        dangerouslySetInnerHTML={{ __html: renderMarkdownBasic(post.bodyMd) }}
      />
      {post.publishedAt ? (
        <p className="text-xs text-gray-400 mt-6">
          Published {new Date(post.publishedAt).toLocaleDateString()}
        </p>
      ) : null}
    </main>
  );
}
