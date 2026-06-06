'use client';

/**
 * JarvisConsoleLoader — client boundary that lazily mounts `JarvisConsole`.
 *
 * `next/dynamic({ ssr: false })` is only permitted inside a Client
 * Component under the Next 15 App Router. The `/jarvis` page itself is a
 * server component (it awaits `getTranslations` and exports `metadata`),
 * so the deferred client-only import lives here instead.
 *
 * Performance: `JarvisConsole` pulls in `@bossnyumba/chat-ui` (voice +
 * adaptive renderer + GenUI primitives) which is heavy. We defer the
 * client bundle so the page header + persona shell paint immediately and
 * the chat console hydrates after first paint. `ssr: false` because the
 * console relies on `window` for Web Speech voice I/O and browser-only
 * SSE streaming.
 */

import dynamic from 'next/dynamic';

const JarvisConsole = dynamic(
  () => import('./JarvisConsole.js').then((m) => ({ default: m.JarvisConsole })),
  {
    ssr: false,
    loading: () => <JarvisConsoleSkeleton />,
  },
);

function JarvisConsoleSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Resident Concierge"
      className="flex h-[60vh] w-full flex-col gap-3 rounded-lg border border-border bg-surface p-6"
    >
      <div className="h-6 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
      <div className="mt-auto h-12 w-full animate-pulse rounded bg-gray-200" />
    </div>
  );
}

export function JarvisConsoleLoader(): JSX.Element {
  return <JarvisConsole />;
}
