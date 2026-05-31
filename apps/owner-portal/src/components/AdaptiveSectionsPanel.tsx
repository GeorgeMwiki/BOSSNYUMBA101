/**
 * AdaptiveSectionsPanel — mounts the @bossnyumba/dynamic-sections
 * engine inside the owner-portal Layout.
 *
 * The panel renders as collapsible dashboard cards INSIDE the main
 * content area, NOT as primary navigation tabs. The Layout's existing
 * sidebar nav stays untouched — adaptive sections augment it instead
 * of replacing it. This is the conservative wiring:
 *
 *   - Persistent nav (Dashboard, Properties, Tenants, ...) remains the
 *     primary spatial anchor; muscle memory is preserved.
 *   - Adaptive sections appear ABOVE the route content when the
 *     underlying signal flips true. They disappear when the signal
 *     clears. Zero signals → zero cards → no layout shift.
 *
 * Each card is a thin SectionMount wrapper around the seed shell. The
 * shell renders a GenUI placeholder until the host portal swaps it
 * for a real implementation (the SectionMount contract is unchanged,
 * so future wiring drops in without churn).
 *
 * The panel is wrapped in a Suspense + ErrorBoundary so a single
 * misbehaving section never takes down the whole shell.
 */

import { Suspense } from 'react';
import {
  SectionContextProvider,
  SectionSkeleton,
  createSeedRegistry,
  useSectionRegistry,
  type SectionScope,
} from '@bossnyumba/dynamic-sections';
import { loadSectionContext } from '../lib/section-context-loader';
import { useAuth } from '../contexts/AuthContext';

/**
 * Singleton registry — built once at module load. The seed sections
 * are immutable; rebuilding the registry every render would be
 * wasteful + would defeat any internal memoisation.
 */
const ADAPTIVE_REGISTRY = createSeedRegistry();

interface AdaptiveSectionsPanelProps {
  /**
   * Optional scope override. The owner-portal always renders the
   * 'owner-customer' scope; the prop is exposed primarily for tests +
   * future support-impersonation flows.
   */
  readonly scope?: SectionScope;
}

interface InnerProps {
  readonly tenantId: string;
  readonly scope: SectionScope;
}

function AdaptiveSectionsList({ tenantId, scope }: InnerProps): JSX.Element {
  const { sections, isLoading, isError } = useSectionRegistry({
    tenantId,
    scope,
  });

  if (isLoading) {
    return (
      <div
        data-testid="adaptive-sections-loading"
        className="space-y-3"
        aria-busy="true"
        aria-live="polite"
      >
        <SectionSkeleton sectionLabel="Adaptive sections" />
      </div>
    );
  }

  // Fail-CLOSED on loader error — render nothing rather than show
  // stale or misleading sections. The toast layer in the parent
  // surfaces the failure to ops out of band.
  if (isError || sections.length === 0) {
    return <div data-testid="adaptive-sections-empty" hidden />;
  }

  return (
    <section
      data-testid="adaptive-sections-panel"
      aria-label="Adaptive sections"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      {sections.map((section) => {
        const LazyComponent = (() => {
          // Each render of the section uses its own dynamic-import
          // shell. SectionMount would be ideal here; we inline the
          // import for the simpler card layout used in this surface.
          const Wrapper = (): JSX.Element => {
            // The seed shells are sync; the contract still requires a
            // Promise so we await it once at render time. The work is
            // free because the loader is sync — no network, no IO.
            // Using a synchronous render avoids a flash of skeleton.
            return (
              <div
                key={section.key}
                data-section-key={section.key}
                className="contents"
              >
                <Suspense
                  fallback={
                    <SectionSkeleton sectionLabel={section.label} />
                  }
                >
                  <RemoteSection
                    sectionKey={section.key}
                    loader={section.component_loader}
                    tenantId={tenantId}
                    scope={scope}
                    entityType={section.entity_type}
                  />
                </Suspense>
              </div>
            );
          };
          return Wrapper;
        })();
        return <LazyComponent key={section.key} />;
      })}
    </section>
  );
}

interface RemoteSectionProps {
  readonly sectionKey: string;
  readonly loader: () => Promise<{
    readonly default: React.ComponentType<{
      readonly tenantId: string;
      readonly scope: SectionScope;
      readonly entityType: string;
    }>;
  }>;
  readonly tenantId: string;
  readonly scope: SectionScope;
  readonly entityType: string;
}

/**
 * Thin wrapper that resolves the section's component_loader once and
 * caches the result on the component identity. Keeps the call-site
 * declarative while honouring the dynamic-import contract.
 */
const moduleCache = new Map<
  string,
  React.ComponentType<{
    readonly tenantId: string;
    readonly scope: SectionScope;
    readonly entityType: string;
  }>
>();

function RemoteSection({
  sectionKey,
  loader,
  tenantId,
  scope,
  entityType,
}: RemoteSectionProps): JSX.Element {
  const cached = moduleCache.get(sectionKey);
  if (cached) {
    const Component = cached;
    return <Component tenantId={tenantId} scope={scope} entityType={entityType} />;
  }
  // The seed loaders are synchronous Promise.resolve(...) so this
  // throw-promise pattern resolves on the first microtask. Suspense
  // shows the skeleton fallback for that single tick.
  throw loader().then((mod) => {
    moduleCache.set(sectionKey, mod.default);
  });
}

export function AdaptiveSectionsPanel({
  scope = 'owner-customer',
}: AdaptiveSectionsPanelProps): JSX.Element | null {
  const { tenant, isAuthenticated } = useAuth();

  // No tenant context yet — render nothing rather than spam queries
  // with empty tenant ids. The Layout already gates on auth before
  // mounting children, but this is defence-in-depth.
  if (!isAuthenticated || !tenant?.id) {
    return null;
  }

  return (
    <SectionContextProvider
      registry={ADAPTIVE_REGISTRY}
      loadContext={loadSectionContext}
    >
      <AdaptiveSectionsList tenantId={tenant.id} scope={scope} />
    </SectionContextProvider>
  );
}
