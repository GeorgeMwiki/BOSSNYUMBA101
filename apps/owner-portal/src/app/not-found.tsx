import Link from 'next/link';
import { Logomark } from '@bossnyumba/design-system';

/**
 * Owner portal — 404 route (App Router). Owner surface is light-first,
 * so tokens resolve to paper/ink; amber stays the single signal color.
 */
export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="absolute left-6 top-6">
        <Logomark size={32} aria-label="BossNyumba" />
      </div>

      <div className="mx-auto w-full max-w-xl text-center">
        <p
          className="font-display text-[9rem] font-medium leading-none tracking-tight text-signal-500/90 sm:text-[11rem]"
          aria-hidden="true"
        >
          404
        </p>

        <h1 className="mt-6 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          This door doesn&rsquo;t open.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground">
          The route you followed isn&rsquo;t here. Try the home page, or ask
          Mwikila what you were looking for.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-signal-500 px-5 py-2.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Back to home
          </Link>
          <Link
            href="/vendors"
            className="inline-flex items-center justify-center rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-signal-500/60 hover:text-signal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Ask Mwikila
          </Link>
        </div>
      </div>
    </main>
  );
}
