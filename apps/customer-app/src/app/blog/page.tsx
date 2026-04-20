/**
 * Public blog index — /blog
 *
 * Lists published platform posts (tenantId = null). Tenant-scoped posts are
 * served from the tenant-specific portal, not here.
 */

export const dynamic = 'force-dynamic';

async function loadPosts(): Promise<
  ReadonlyArray<{ slug: string; title: string; excerpt: string; publishedAt: string | null }>
> {
  const base = process.env.BOSSNYUMBA_API_BASE ?? '';
  if (!base) return [];
  try {
    const res = await fetch(`${base}/api/v1/public/blog`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      posts?: Array<{ slug: string; title: string; excerpt: string; publishedAt: string | null }>;
    };
    return data.posts ?? [];
  } catch {
    return [];
  }
}

export default async function BlogIndexPage() {
  const posts = await loadPosts();
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Estate-management insights</h1>
      <p className="text-gray-600">
        Notes from Mr. Mwikila on running estates, managing tenants, and staying on top of
        compliance.
      </p>
      {posts.length === 0 ? (
        <p className="text-gray-500">No posts yet. Check back soon.</p>
      ) : (
        <ul className="space-y-4">
          {posts.map((p) => (
            <li key={p.slug} className="p-4 border rounded">
              <h2 className="text-xl font-medium">
                <a href={`/blog/${encodeURIComponent(p.slug)}`} className="hover:underline">
                  {p.title}
                </a>
              </h2>
              <p className="text-gray-700 mt-1">{p.excerpt}</p>
              {p.publishedAt ? (
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(p.publishedAt).toLocaleDateString()}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
