/**
 * Lightweight glob matcher for the pre-tool-use hook. Supports `*` and `**`
 * which is all we need for the deny-globs in the spec.
 *
 * Kept separate from `execute-phase.globToRegex` so the two surfaces can
 * diverge without coupling. The semantics here are POSIX-shell-glob-like.
 */

export function globToMatcher(glob: string): (path: string) => boolean {
  // Normalize leading ./ and trailing /
  const normalized = glob.replace(/^\.\//, '').replace(/\/+$/, '');
  const escaped = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLESTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLESTAR__/g, '.*');
  const re = new RegExp(`^${escaped}$`);
  return (p): boolean => re.test(normalizePath(p));
}

function normalizePath(p: string): string {
  return p.replace(/^\.\//, '').replace(/^\/+/, '').replace(/\\+/g, '/');
}

export function anyGlobMatches(
  globs: readonly string[],
  path: string,
): { matched: true; glob: string } | { matched: false } {
  for (const g of globs) {
    if (globToMatcher(g)(path)) return { matched: true, glob: g };
  }
  return { matched: false };
}
