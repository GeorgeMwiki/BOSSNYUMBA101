'use client';

import type { AskChip } from '@/lib/ask-client';

interface Props {
  readonly chip: AskChip;
  readonly onSelect: (chip: AskChip) => void;
}

/**
 * Clickable chip — clicking inserts the chip's `prompt` into the
 * input + auto-submits (the parent handles that wiring; here we just
 * fire `onSelect`).
 *
 * Visual: rounded pill, brand-light fill, brand-dark text. Mobile-tap
 * target is at least 44x44 (Apple HIG minimum).
 */
export function StartingPointChip({ chip, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(chip)}
      className="inline-flex min-h-[44px] items-center rounded-chip bg-brand-light px-4 py-2 text-sm font-medium text-brand-dark shadow-chip transition hover:bg-brand hover:text-white focus:outline-none focus:ring-2 focus:ring-brand"
      title={chip.reason}
      aria-label={`${chip.label} — ${chip.reason}`}
    >
      {chip.label}
    </button>
  );
}
