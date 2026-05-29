import { MR_MWIKILA_CANONICAL_DISPLAY } from '@/lib/persona';

/**
 * MwikilaChip — small inline pill that surfaces the canonical Mr.
 * Mwikila identity on a marketing page. Audience pages embed it under
 * the hero or alongside CTAs so visitors immediately associate the
 * persona with the product.
 *
 * The identity string is sourced from the local persona mirror
 * (synced with `packages/agent-platform/src/canonical-display.ts`).
 * Do NOT hard-code the persona name anywhere else in marketing.
 */
export function MwikilaChip({
  variant = 'default',
}: {
  readonly variant?: 'default' | 'compact';
}) {
  if (variant === 'compact') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface/60 px-2.5 py-1 text-xs text-neutral-400 backdrop-blur">
        <span
          className="inline-flex h-1.5 w-1.5 rounded-full bg-signal-500"
          aria-hidden="true"
        />
        <span className="font-semibold text-foreground">
          {MR_MWIKILA_CANONICAL_DISPLAY.name}
        </span>
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-surface/80 px-4 py-2 backdrop-blur">
      <span
        className="inline-flex h-2 w-2 rounded-full bg-signal-500"
        aria-hidden="true"
      />
      <span className="text-sm font-semibold text-foreground">
        {MR_MWIKILA_CANONICAL_DISPLAY.name}
      </span>
      <span className="hidden h-3 w-px bg-border sm:inline-block" aria-hidden="true" />
      <span className="hidden text-xs text-neutral-500 sm:inline">
        {MR_MWIKILA_CANONICAL_DISPLAY.title}
      </span>
    </div>
  );
}
