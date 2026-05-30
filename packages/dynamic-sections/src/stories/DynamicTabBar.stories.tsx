/**
 * `<DynamicTabBar>` integrated stories — show the dynamic tab
 * appearance behaviour end-to-end:
 *
 *   - FirstDayTenant: zero entities → zero tabs → empty-state shows
 *   - TwoTabsTenant: tenant has customers + properties → only those
 *     two tabs render
 *   - FullSeedAdmin: internal-admin + platform_ops sees all eight
 *     customer sections (override) plus internal-staff if data exists
 *
 * Each story renders the full `DynamicTabBar` against a stub
 * `useSectionRegistry` provider — illustrating the production wiring
 * for CL-B1's follow-up adoption.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { DynamicTabBar } from '../components/DynamicTabBar.js';
import { seedSections, sectionSignalKeys } from '../seed/seed-sections.js';
import { useSectionRegistry } from '../hooks/use-section-registry.js';
import { filterSections } from '../registry/filter.js';
import {
  StoryShell,
  DEMO_TENANT_ID,
  DEMO_ORG_ID,
  DEMO_SCOPE_OWNER,
  DEMO_SCOPE_ADMIN,
  makeStoryContextLoader,
} from './utils.js';

type Story = StoryObj;

const meta: Meta = {
  title: 'DynamicSections/DynamicTabBar',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};
export default meta;

function HookedTabBar({ scope }: { readonly scope: 'owner-customer' | 'internal-admin' }) {
  const { sections, isLoading } = useSectionRegistry({
    tenantId: DEMO_TENANT_ID,
    orgId: DEMO_ORG_ID,
    scope,
  });
  if (isLoading) {
    return (
      <div className="p-6 text-sm text-slate-500" role="status">
        Loading tab registry…
      </div>
    );
  }
  return (
    <DynamicTabBar
      sections={sections}
      tenantId={DEMO_TENANT_ID}
      orgId={DEMO_ORG_ID}
      scope={scope}
    />
  );
}

export const FirstDayTenant: Story = {
  name: 'First-day tenant · no entities · empty-state',
  render: () => (
    <StoryShell
      sections={seedSections}
      loader={makeStoryContextLoader({})}
    >
      <HookedTabBar scope={DEMO_SCOPE_OWNER} />
    </StoryShell>
  ),
};

export const TwoTabsTenant: Story = {
  name: 'Owner · two signals · two sections',
  render: () => (
    <StoryShell
      sections={seedSections}
      loader={makeStoryContextLoader({
        entityCounts: {
          [sectionSignalKeys.activeLeases]: 12,
          [sectionSignalKeys.rentDueSoon]: 3,
        },
      })}
    >
      <HookedTabBar scope={DEMO_SCOPE_OWNER} />
    </StoryShell>
  ),
};

export const FullSeedAdmin: Story = {
  name: 'Internal admin · platform_ops · all customer sections visible',
  render: () => (
    <StoryShell
      sections={seedSections}
      loader={makeStoryContextLoader({
        roles: ['platform_ops'],
        entityCounts: { [sectionSignalKeys.internalStaff]: 4 },
      })}
    >
      <HookedTabBar scope={DEMO_SCOPE_ADMIN} />
    </StoryShell>
  ),
};

export const LiveAppearance: Story = {
  name: 'Live appearance · simulated signal arrival',
  render: () => {
    // Simulate signals arriving — first 0 sections, then after 1.5s
    // the active-leases section appears, then after 3s rent-due-soon.
    function LiveDemo() {
      const [tick, setTick] = useState(0);
      useEffect(() => {
        const a = setTimeout(() => setTick(1), 1500);
        const b = setTimeout(() => setTick(2), 3000);
        return () => {
          clearTimeout(a);
          clearTimeout(b);
        };
      }, []);
      const counts: Record<string, number> =
        tick === 0
          ? {}
          : tick === 1
            ? { [sectionSignalKeys.activeLeases]: 1 }
            : {
                [sectionSignalKeys.activeLeases]: 1,
                [sectionSignalKeys.rentDueSoon]: 1,
              };
      const ctx = {
        tenantId: DEMO_TENANT_ID,
        scope: DEMO_SCOPE_OWNER,
        entityCounts: counts,
        roles: [],
        featureFlags: [],
      };
      const visible = filterSections(seedSections, ctx);
      return (
        <div className="p-4">
          <div className="mb-3 text-xs text-slate-500">
            Demo: sections appear over 3 seconds as signals arrive.
            tick={tick} · {visible.length} sections.
          </div>
          <DynamicTabBar
            sections={visible}
            tenantId={DEMO_TENANT_ID}
            scope={DEMO_SCOPE_OWNER}
          />
        </div>
      );
    }
    return <LiveDemo />;
  },
};

export const MobileLayout: Story = {
  name: 'Mobile layout · hamburger collapse',
  parameters: {
    viewport: { defaultViewport: 'mobile' },
  },
  render: () => (
    <StoryShell
      sections={seedSections}
      loader={makeStoryContextLoader({
        entityCounts: {
          [sectionSignalKeys.activeLeases]: 3,
          [sectionSignalKeys.rentDueSoon]: 1,
          [sectionSignalKeys.maintenanceOpen]: 4,
        },
      })}
    >
      <HookedTabBar scope={DEMO_SCOPE_OWNER} />
    </StoryShell>
  ),
};
