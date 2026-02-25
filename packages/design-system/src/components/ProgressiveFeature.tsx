/**
 * Progressive Feature Discovery Component - BOSSNYUMBA
 *
 * The intelligent UI system that expands based on user needs.
 * Features are only shown when:
 *  1. The user's context type supports them
 *  2. The user has discovered/enabled them
 *  3. The user's usage pattern suggests they need them
 *
 * This prevents bombarding users with every feature at once.
 * Instead, the app grows with the user.
 *
 * Usage:
 *   <ProgressiveFeature feature="payments.plans" contextType="tenant">
 *     <PaymentPlanButton />
 *   </ProgressiveFeature>
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ContextType = 'owner' | 'tenant' | 'technician' | 'manager' | 'admin';

export interface UserContextData {
  id: string;
  contextType: ContextType;
  enabledFeatures: string[];
  onboardingCompleted: boolean;
  entityType: 'individual' | 'company';
}

export interface FeatureConfig {
  /** Feature key (e.g., 'payments.plans', 'maintenance.voice_report') */
  key: string;
  /** Which context types can see this feature */
  availableFor: ContextType[];
  /** Minimum features that must be enabled before this appears (prerequisites) */
  requires?: string[];
  /** Feature is always visible for these contexts (core feature) */
  coreFor?: ContextType[];
  /** Feature appears after N uses of another feature (smart discovery) */
  appearsAfterUsageOf?: { feature: string; count: number };
}

interface ProgressiveContextValue {
  activeContext: UserContextData | null;
  contexts: UserContextData[];
  enabledFeatures: Set<string>;
  isFeatureAvailable: (featureKey: string) => boolean;
  isFeatureEnabled: (featureKey: string) => boolean;
  discoverFeature: (featureKey: string) => void;
  trackUsage: (featureKey: string) => void;
  switchContext: (contextId: string) => void;
  setContexts: (contexts: UserContextData[], activeId?: string) => void;
}

// ============================================================================
// Feature Registry - defines all features and their availability
// ============================================================================

export const FEATURE_REGISTRY: FeatureConfig[] = [
  // ---- Tenant Features (expand as needed) ----
  { key: 'payments', availableFor: ['tenant', 'owner', 'manager', 'admin'], coreFor: ['tenant'] },
  { key: 'payments.history', availableFor: ['tenant', 'owner', 'manager'], coreFor: ['tenant'] },
  { key: 'payments.mpesa', availableFor: ['tenant'], coreFor: ['tenant'] },
  { key: 'payments.bank_transfer', availableFor: ['tenant'] },
  { key: 'payments.plans', availableFor: ['tenant'], requires: ['payments'] },
  { key: 'payments.auto_pay', availableFor: ['tenant'], requires: ['payments.plans'] },

  { key: 'maintenance', availableFor: ['tenant', 'manager', 'technician'], coreFor: ['tenant'] },
  { key: 'maintenance.voice_report', availableFor: ['tenant'], requires: ['maintenance'] },
  { key: 'maintenance.photo_evidence', availableFor: ['tenant', 'technician'], coreFor: ['tenant'] },

  { key: 'lease', availableFor: ['tenant', 'manager', 'owner'], coreFor: ['tenant'] },
  { key: 'lease.renewal', availableFor: ['tenant', 'manager'], requires: ['lease'] },
  { key: 'lease.move_out', availableFor: ['tenant', 'manager'], requires: ['lease'] },
  { key: 'lease.documents', availableFor: ['tenant', 'manager', 'owner'] },
  { key: 'lease.e_sign', availableFor: ['tenant', 'manager', 'owner'], requires: ['lease.documents'] },

  { key: 'community', availableFor: ['tenant'] },
  { key: 'community.marketplace', availableFor: ['tenant'], requires: ['community'] },
  { key: 'community.events', availableFor: ['tenant'], requires: ['community'] },

  { key: 'utilities', availableFor: ['tenant', 'manager'] },
  { key: 'utilities.submit_reading', availableFor: ['tenant'], requires: ['utilities'] },

  { key: 'emergencies', availableFor: ['tenant', 'manager'] },

  // ---- Owner Features ----
  { key: 'portfolio', availableFor: ['owner', 'admin'], coreFor: ['owner'] },
  { key: 'analytics', availableFor: ['owner', 'admin', 'manager'], coreFor: ['owner'] },
  { key: 'analytics.revenue', availableFor: ['owner', 'admin'], requires: ['analytics'] },
  { key: 'analytics.occupancy', availableFor: ['owner', 'admin', 'manager'], requires: ['analytics'] },
  { key: 'analytics.expenses', availableFor: ['owner', 'admin'], requires: ['analytics'] },
  { key: 'financial', availableFor: ['owner', 'admin'], coreFor: ['owner'] },
  { key: 'financial.disbursements', availableFor: ['owner'], requires: ['financial'] },
  { key: 'approvals', availableFor: ['owner', 'admin'] },
  { key: 'tenants_list', availableFor: ['owner', 'manager', 'admin'] },
  { key: 'vendors_list', availableFor: ['owner', 'manager', 'admin'] },
  { key: 'budgets', availableFor: ['owner', 'admin'] },
  { key: 'compliance', availableFor: ['owner', 'admin', 'manager'] },

  // ---- Manager Features ----
  { key: 'properties', availableFor: ['manager', 'admin', 'owner'], coreFor: ['manager'] },
  { key: 'units', availableFor: ['manager', 'admin'], coreFor: ['manager'] },
  { key: 'customers', availableFor: ['manager', 'admin'], coreFor: ['manager'] },
  { key: 'work_orders', availableFor: ['manager', 'technician', 'admin'], coreFor: ['manager', 'technician'] },
  { key: 'inspections', availableFor: ['manager', 'admin'], coreFor: ['manager'] },
  { key: 'leases_mgmt', availableFor: ['manager', 'admin'], coreFor: ['manager'] },
  { key: 'collections', availableFor: ['manager', 'admin'] },
  { key: 'sla', availableFor: ['manager', 'admin'] },
  { key: 'calendar', availableFor: ['manager', 'technician'] },

  // ---- Technician Features (mobile-only) ----
  { key: 'tech.assigned_orders', availableFor: ['technician'], coreFor: ['technician'] },
  { key: 'tech.schedule', availableFor: ['technician'], coreFor: ['technician'] },
  { key: 'tech.sign_off', availableFor: ['technician'], coreFor: ['technician'] },
  { key: 'tech.photo_proof', availableFor: ['technician'], coreFor: ['technician'] },

  // ---- Admin Features ----
  { key: 'tenants_mgmt', availableFor: ['admin'], coreFor: ['admin'] },
  { key: 'users', availableFor: ['admin'], coreFor: ['admin'] },
  { key: 'roles', availableFor: ['admin'], coreFor: ['admin'] },
  { key: 'billing_mgmt', availableFor: ['admin'], coreFor: ['admin'] },
  { key: 'communications', availableFor: ['admin'] },
  { key: 'integrations', availableFor: ['admin'] },

  // ---- Common Features ----
  { key: 'profile', availableFor: ['tenant', 'owner', 'technician', 'manager', 'admin'], coreFor: ['tenant', 'owner', 'technician', 'manager', 'admin'] },
  { key: 'notifications', availableFor: ['tenant', 'owner', 'technician', 'manager', 'admin'], coreFor: ['tenant', 'owner', 'technician', 'manager', 'admin'] },
  { key: 'messages', availableFor: ['tenant', 'owner', 'manager', 'admin'] },
  { key: 'reports', availableFor: ['owner', 'manager', 'admin'] },
  { key: 'documents', availableFor: ['tenant', 'owner', 'manager', 'admin'] },
  { key: 'support', availableFor: ['tenant', 'owner', 'technician', 'manager', 'admin'] },

  // ---- Dynamic: Become an owner (any tenant can list their property) ----
  { key: 'become_owner', availableFor: ['tenant'] },
  // ---- Dynamic: Become a tenant (any owner can also rent somewhere) ----
  { key: 'become_tenant', availableFor: ['owner'] },
];

// ============================================================================
// Context Provider
// ============================================================================

const ProgressiveContext = createContext<ProgressiveContextValue | undefined>(undefined);

export function ProgressiveProvider({ children }: { children: React.ReactNode }) {
  const [contexts, setContextsState] = useState<UserContextData[]>([]);
  const [activeContext, setActiveContext] = useState<UserContextData | null>(null);
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  // Update enabled features when context changes
  useEffect(() => {
    if (!activeContext) {
      setEnabledFeatures(new Set());
      return;
    }

    const features = new Set<string>();

    for (const config of FEATURE_REGISTRY) {
      // Always show core features for this context type
      if (config.coreFor?.includes(activeContext.contextType)) {
        features.add(config.key);
        continue;
      }

      // Show if available for context type AND explicitly enabled
      if (
        config.availableFor.includes(activeContext.contextType) &&
        activeContext.enabledFeatures.includes(config.key)
      ) {
        // Check prerequisites
        if (config.requires) {
          const allReqsMet = config.requires.every((req) => features.has(req) || activeContext.enabledFeatures.includes(req));
          if (allReqsMet) features.add(config.key);
        } else {
          features.add(config.key);
        }
      }
    }

    setEnabledFeatures(features);
  }, [activeContext]);

  const isFeatureAvailable = useCallback((featureKey: string): boolean => {
    if (!activeContext) return false;
    const config = FEATURE_REGISTRY.find((f) => f.key === featureKey);
    if (!config) return false;
    return config.availableFor.includes(activeContext.contextType);
  }, [activeContext]);

  const isFeatureEnabled = useCallback((featureKey: string): boolean => {
    return enabledFeatures.has(featureKey);
  }, [enabledFeatures]);

  const discoverFeature = useCallback((featureKey: string) => {
    setEnabledFeatures((prev) => {
      const next = new Set(prev);
      next.add(featureKey);
      return next;
    });

    // Persist to backend
    if (activeContext) {
      fetch('/api/v1/auth/v2/features/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId: activeContext.id, featureKey }),
      }).catch(() => { /* non-critical */ });
    }
  }, [activeContext]);

  const trackUsage = useCallback((featureKey: string) => {
    setUsageCounts((prev) => ({
      ...prev,
      [featureKey]: (prev[featureKey] || 0) + 1,
    }));

    // Check if any features should auto-discover based on usage
    for (const config of FEATURE_REGISTRY) {
      if (
        config.appearsAfterUsageOf &&
        config.appearsAfterUsageOf.feature === featureKey
      ) {
        const currentCount = (usageCounts[featureKey] || 0) + 1;
        if (currentCount >= config.appearsAfterUsageOf.count) {
          discoverFeature(config.key);
        }
      }
    }

    // Persist to backend
    if (activeContext) {
      fetch('/api/v1/auth/v2/features/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId: activeContext.id, featureKey }),
      }).catch(() => { /* non-critical */ });
    }
  }, [activeContext, usageCounts, discoverFeature]);

  const switchContext = useCallback((contextId: string) => {
    const ctx = contexts.find((c) => c.id === contextId);
    if (ctx) setActiveContext(ctx);
  }, [contexts]);

  const setContexts = useCallback((newContexts: UserContextData[], activeId?: string) => {
    setContextsState(newContexts);
    if (activeId) {
      const active = newContexts.find((c) => c.id === activeId);
      if (active) setActiveContext(active);
    } else if (newContexts.length > 0) {
      setActiveContext(newContexts[0]);
    }
  }, []);

  return (
    <ProgressiveContext.Provider value={{
      activeContext,
      contexts,
      enabledFeatures,
      isFeatureAvailable,
      isFeatureEnabled,
      discoverFeature,
      trackUsage,
      switchContext,
      setContexts,
    }}>
      {children}
    </ProgressiveContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useProgressiveFeatures() {
  const context = useContext(ProgressiveContext);
  if (!context) {
    throw new Error('useProgressiveFeatures must be used within a ProgressiveProvider');
  }
  return context;
}

// ============================================================================
// Component: Conditionally render based on feature availability
// ============================================================================

interface ProgressiveFeatureProps {
  /** Feature key from FEATURE_REGISTRY */
  feature: string;
  /** If true, only check if feature is available (not if enabled) */
  checkAvailabilityOnly?: boolean;
  /** Render when feature is not available/enabled */
  fallback?: React.ReactNode;
  /** Auto-discover this feature when it becomes visible */
  autoDiscover?: boolean;
  children: React.ReactNode;
}

export function ProgressiveFeature({
  feature,
  checkAvailabilityOnly = false,
  fallback = null,
  autoDiscover = false,
  children,
}: ProgressiveFeatureProps) {
  const { isFeatureAvailable, isFeatureEnabled, discoverFeature } = useProgressiveFeatures();

  const available = isFeatureAvailable(feature);
  const enabled = checkAvailabilityOnly ? available : isFeatureEnabled(feature);

  useEffect(() => {
    if (autoDiscover && available && !isFeatureEnabled(feature)) {
      discoverFeature(feature);
    }
  }, [autoDiscover, available, feature, discoverFeature, isFeatureEnabled]);

  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}

// ============================================================================
// Component: Context Switcher (switch between owner/tenant/etc)
// ============================================================================

interface ContextSwitcherProps {
  className?: string;
}

export function ContextSwitcher({ className }: ContextSwitcherProps) {
  const { contexts, activeContext, switchContext } = useProgressiveFeatures();

  if (contexts.length <= 1) return null;

  const contextLabels: Record<string, string> = {
    owner: 'Property Owner',
    tenant: 'Tenant',
    technician: 'Technician',
    manager: 'Estate Manager',
    admin: 'Admin',
  };

  return (
    <div className={className}>
      <select
        value={activeContext?.id || ''}
        onChange={(e) => switchContext(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {contexts.map((ctx) => (
          <option key={ctx.id} value={ctx.id}>
            {ctx.displayName || contextLabels[ctx.contextType] || ctx.contextType}
            {ctx.entityType === 'company' && ctx.companyName ? ` (${ctx.companyName})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
