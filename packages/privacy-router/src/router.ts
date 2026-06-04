/**
 * Privacy-aware AI router — pure routing core (core 2 of 2).
 *
 * `createPrivacyRouter(deps)` returns a router bound to injected ports and a
 * policy. Routing rules:
 *
 *   RESTRICTED   -> local model only (PII stripped even for local).
 *                   DENIED if the local endpoint is unavailable.
 *   CONFIDENTIAL -> approved cloud provider + mandatory PII stripping.
 *   INTERNAL     -> approved cloud provider, no PII stripping.
 *   PUBLIC       -> approved cloud provider, no restrictions.
 *
 * No `node:*`, no `fetch`, no `process.env`, no `console`. Every side effect
 * (audit persistence, the clock, local-endpoint health, field classification,
 * the optional audit sink) is an injected port. Audit persistence is async and
 * immutable via {@link AuditEntryStore}; the in-memory reference adapter is in
 * `./in-memory-store`.
 */

import { DEFAULT_PRIVACY_POLICY, type PrivacyPolicy } from './policy';
import {
  systemClock,
  type AuditEntryStore,
  type FieldClassifierPort,
  type LocalEndpointHealthPort,
  type PiiStripperPort,
  type PrivacyAuditSink,
  type PrivacyClock,
} from './ports';
import { createInMemoryAuditStore } from './in-memory-store';
import {
  CLASSIFICATION_ORDER,
  type ApprovedCloudProvider,
  type DataClassification,
  type PrivacyAuditEntry,
  type PrivacyRoutingRequest,
  type PrivacyRoutingResult,
} from './types';

/** Dependencies the router is constructed with. */
export interface PrivacyRouterDeps {
  readonly pii: PiiStripperPort;
  readonly localHealth: LocalEndpointHealthPort;
  /**
   * Optional field classifier. Absent => field paths only escalate via the
   * policy's restricted-prefix list.
   */
  readonly fieldClassifier?: FieldClassifierPort;
  /** Policy. Defaults to {@link DEFAULT_PRIVACY_POLICY}. */
  readonly policy?: PrivacyPolicy;
  /**
   * Audit store. Defaults to an in-memory ring buffer (1000 entries). The
   * composition root injects a durable, append-only store in production.
   */
  readonly auditStore?: AuditEntryStore;
  /** Optional fire-and-forget audit sink. Never awaited on the hot path. */
  readonly auditSink?: PrivacyAuditSink;
  /** Clock override for deterministic tests. Defaults to {@link systemClock}. */
  readonly clock?: PrivacyClock;
}

/** Public surface of a constructed router. */
export interface PrivacyRouter {
  readonly route: (
    request: PrivacyRoutingRequest,
  ) => Promise<PrivacyRoutingResult>;
  readonly classify: (request: PrivacyRoutingRequest) => DataClassification;
  readonly isCloudAllowed: (classification: DataClassification) => boolean;
  readonly getAuditLog: (
    limit?: number,
  ) => Promise<ReadonlyArray<PrivacyAuditEntry>>;
  readonly getAuditStats: () => Promise<PrivacyAuditStats>;
  readonly clearAuditLog: () => Promise<void>;
}

export interface PrivacyAuditStats {
  readonly total: number;
  readonly byClassification: Readonly<Record<DataClassification, number>>;
  readonly byEndpoint: Readonly<Record<string, number>>;
  readonly deniedCount: number;
  readonly piiStrippedCount: number;
}

/** Return the more restrictive of two classifications. */
function elevate(
  current: DataClassification,
  candidate: DataClassification,
): DataClassification {
  const c = CLASSIFICATION_ORDER.indexOf(current);
  const d = CLASSIFICATION_ORDER.indexOf(candidate);
  return d > c ? candidate : current;
}

export function createPrivacyRouter(deps: PrivacyRouterDeps): PrivacyRouter {
  const policy = deps.policy ?? DEFAULT_PRIVACY_POLICY;
  const clock = deps.clock ?? systemClock;
  const auditStore = deps.auditStore ?? createInMemoryAuditStore();

  /**
   * Safe field classification — the port must never throw into routing. A
   * thrown lookup degrades to 'PUBLIC' so the restricted-prefix list still
   * governs the final tier.
   */
  function classifyFieldSafe(fieldPath: string): DataClassification {
    if (!deps.fieldClassifier) return 'PUBLIC';
    try {
      return deps.fieldClassifier.classifyField(fieldPath);
    } catch {
      return 'PUBLIC';
    }
  }

  /**
   * Fail-closed local-endpoint health. A thrown error or a rejected promise is
   * treated as "unhealthy" so RESTRICTED data is denied, never leaked to cloud.
   */
  async function isLocalHealthySafe(): Promise<boolean> {
    try {
      return await deps.localHealth.isHealthy();
    } catch {
      return false;
    }
  }

  function resolveClassification(
    request: PrivacyRoutingRequest,
  ): DataClassification {
    if (request.classificationOverride) {
      return request.classificationOverride;
    }
    let highest: DataClassification = 'PUBLIC';

    if (request.fieldPaths && request.fieldPaths.length > 0) {
      for (const fieldPath of request.fieldPaths) {
        highest = elevate(highest, classifyFieldSafe(fieldPath));
        const isRestricted = policy.restrictedFieldPrefixes.some((prefix) =>
          fieldPath.startsWith(prefix),
        );
        if (isRestricted) {
          highest = elevate(highest, 'RESTRICTED');
        }
      }
    }

    if (request.taskCategory) {
      const taskLevel = policy.taskCategoryClassification[request.taskCategory];
      if (taskLevel) {
        highest = elevate(highest, taskLevel);
      }
    }

    // Content scan bumps PUBLIC/INTERNAL to at least CONFIDENTIAL when PII is
    // present, so a public task carrying a stray NIDA is protected.
    if (highest === 'PUBLIC' || highest === 'INTERNAL') {
      if (deps.pii.containsPii(request.text)) {
        highest = elevate(highest, 'CONFIDENTIAL');
      }
    }

    return highest;
  }

  function selectCloudProvider(
    preferred?: ApprovedCloudProvider,
  ): ApprovedCloudProvider {
    if (preferred && policy.approvedCloudProviders.includes(preferred)) {
      return preferred;
    }
    // First approved provider is the platform default (Claude).
    return policy.approvedCloudProviders[0] ?? 'claude';
  }

  async function routeRestricted(
    request: PrivacyRoutingRequest,
    timestamp: string,
  ): Promise<PrivacyRoutingResult> {
    const strip = deps.pii.stripPii(request.text, request.knownNames);
    const strippedFields = Object.keys(strip.mappings);
    const healthy = await isLocalHealthySafe();

    if (!healthy) {
      return {
        endpoint: 'DENIED',
        piiStripped: true,
        strippedFields,
        classification: 'RESTRICTED',
        reason:
          'RESTRICTED data cannot be sent to cloud providers and the local ' +
          'model is unavailable. Request denied per BOT Act data-residency rules.',
        timestamp,
      };
    }

    return {
      endpoint: 'ollama',
      piiStripped: true,
      strippedFields,
      classification: 'RESTRICTED',
      reason:
        'RESTRICTED data routed to the local model with full PII stripping. ' +
        'No data leaves the premises.',
      timestamp,
      piiMappings: strip.mappings,
      processedText: strip.stripped,
    };
  }

  function routeConfidential(
    request: PrivacyRoutingRequest,
    timestamp: string,
  ): PrivacyRoutingResult {
    const strip = deps.pii.stripPii(request.text, request.knownNames);
    const strippedFields = Object.keys(strip.mappings);
    const provider = selectCloudProvider(request.preferredProvider);
    return {
      endpoint: provider,
      piiStripped: true,
      strippedFields,
      classification: 'CONFIDENTIAL',
      reason:
        `CONFIDENTIAL data routed to ${provider} with mandatory PII stripping. ` +
        `${strippedFields.length} field(s) stripped; transport encryption required.`,
      timestamp,
      piiMappings: strip.mappings,
      processedText: strip.stripped,
    };
  }

  function routeOpen(
    request: PrivacyRoutingRequest,
    classification: 'INTERNAL' | 'PUBLIC',
    timestamp: string,
  ): PrivacyRoutingResult {
    const provider = selectCloudProvider(request.preferredProvider);
    const reason =
      classification === 'INTERNAL'
        ? `INTERNAL data routed to ${provider} with transport encryption. No PII stripping required.`
        : `PUBLIC data routed to ${provider}. No restrictions applied.`;
    return {
      endpoint: provider,
      piiStripped: false,
      strippedFields: [],
      classification,
      reason,
      timestamp,
      processedText: request.text,
    };
  }

  async function routeByClassification(
    request: PrivacyRoutingRequest,
    classification: DataClassification,
    timestamp: string,
  ): Promise<PrivacyRoutingResult> {
    switch (classification) {
      case 'RESTRICTED':
        return routeRestricted(request, timestamp);
      case 'CONFIDENTIAL':
        return routeConfidential(request, timestamp);
      case 'INTERNAL':
        return routeOpen(request, 'INTERNAL', timestamp);
      case 'PUBLIC':
        return routeOpen(request, 'PUBLIC', timestamp);
    }
  }

  /** Emit to the optional sink; fire-and-forget, never throws into routing. */
  function emitToSink(entry: PrivacyAuditEntry): void {
    if (!deps.auditSink) return;
    try {
      deps.auditSink.log(entry);
    } catch {
      // A failing sink must never break or stall a routing decision.
    }
  }

  return {
    async route(request) {
      const classification = resolveClassification(request);
      const timestamp = clock.now().toISOString();
      const result = await routeByClassification(
        request,
        classification,
        timestamp,
      );
      const entry: PrivacyAuditEntry = {
        timestamp,
        classification,
        endpoint: result.endpoint,
        piiStripped: result.piiStripped,
        strippedFieldCount: result.strippedFields.length,
        taskCategory: request.taskCategory ?? 'unknown',
        reason: result.reason,
      };
      await auditStore.append(entry);
      emitToSink(entry);
      return result;
    },

    classify(request) {
      return resolveClassification(request);
    },

    isCloudAllowed(classification) {
      return classification !== 'RESTRICTED';
    },

    async getAuditLog(limit = 100) {
      return auditStore.list(limit);
    },

    async getAuditStats() {
      const entries = await auditStore.all();
      const byClassification: Record<DataClassification, number> = {
        PUBLIC: 0,
        INTERNAL: 0,
        CONFIDENTIAL: 0,
        RESTRICTED: 0,
      };
      const byEndpoint: Record<string, number> = {};
      let deniedCount = 0;
      let piiStrippedCount = 0;
      for (const entry of entries) {
        byClassification[entry.classification] += 1;
        byEndpoint[entry.endpoint] = (byEndpoint[entry.endpoint] ?? 0) + 1;
        if (entry.endpoint === 'DENIED') deniedCount += 1;
        if (entry.piiStripped) piiStrippedCount += 1;
      }
      return {
        total: entries.length,
        byClassification,
        byEndpoint,
        deniedCount,
        piiStrippedCount,
      };
    },

    async clearAuditLog() {
      await auditStore.clear();
    },
  };
}
