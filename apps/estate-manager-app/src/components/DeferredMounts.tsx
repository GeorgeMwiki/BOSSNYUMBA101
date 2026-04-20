'use client';

import dynamic from 'next/dynamic';
import type React from 'react';
import type { ComponentType } from 'react';

/**
 * Wave-21 Agent R: defers heavy client-only mounts (Mwikila chat widget +
 * Spotlight command palette) so the root Server Component's module graph
 * stays small at cold-compile. Both are post-hydration UI — users never see
 * them in the first paint — so ssr: false is safe.
 *
 * This file lives behind a 'use client' boundary specifically so we can use
 * `next/dynamic({ ssr: false })` without tripping Next 15's Server Component
 * guard.
 */

type MwikilaProps = { readonly children: React.ReactNode };

const MwikilaWidgetMount = dynamic(
  async () => {
    const mod = await import('./MwikilaWidgetMount.js');
    return mod.MwikilaWidgetMount as ComponentType<MwikilaProps>;
  },
  { ssr: false }
) as ComponentType<MwikilaProps>;

const SpotlightMount = dynamic(
  async () => {
    const mod = await import('./SpotlightMount.js');
    return mod.SpotlightMount as ComponentType<Record<string, never>>;
  },
  { ssr: false }
) as ComponentType<Record<string, never>>;

export interface DeferredMountsProps {
  readonly children: React.ReactNode;
  readonly bottomNavigation: React.ReactNode;
}

export function DeferredMounts({
  children,
  bottomNavigation,
}: DeferredMountsProps): JSX.Element {
  return (
    <MwikilaWidgetMount>
      <>
        {children}
        {bottomNavigation}
        <SpotlightMount />
      </>
    </MwikilaWidgetMount>
  );
}
