/**
 * @bossnyumba/api-sdk — Jarvis client.
 *
 * Typed POST helpers for the per-user Jarvis surfaces exposed by the
 * api-gateway:
 *
 *   /api/v1/customer/jarvis/*    — tenant residents
 *   /api/v1/owner/jarvis/*       — property owners
 *   /api/v1/manager/jarvis/*     — estate managers
 *   /api/v1/admin/jarvis/*       — agency admins
 *   /api/v1/platform/jarvis/*    — BossNyumba HQ employees
 *
 * Each frontend (customer-app, owner-portal, estate-manager-app,
 * admin-portal, admin-platform-portal) wraps this client with its
 * surface prefix and uses the same call shapes.
 */

import type { BossnyumbaClient } from './client.js';

/**
 * Jarvis surface — names the seat the requester sits in.
 *
 * Mirrors LITFIN's tiered AI mapping, scoped to property:
 *   'customer'  ↔ LITFIN borrower         (tenant resident)
 *   'manager'   ↔ LITFIN officer          (estate manager)
 *   'owner'     ↔ LITFIN bank/org admin   (owner — IS the admin)
 *   'platform'  ↔ LITFIN HQ internal      (BossNyumba HQ)
 *
 * `'admin'` is kept as a deprecated alias of `'owner'` for backwards
 * compatibility with the legacy `apps/admin-portal/`. New consumers
 * should use `'owner'`. See `apps/admin-portal/DEPRECATED.md`.
 */
export type JarvisSurface =
  | 'customer'
  | 'owner'
  | 'manager'
  /** @deprecated alias of `'owner'` — owners are the admins */
  | 'admin'
  | 'platform';

export type JarvisTier =
  | 'tenant' | 'lease' | 'unit' | 'block'
  | 'property' | 'portfolio' | 'org' | 'industry';

export type JarvisStakes = 'low' | 'medium' | 'high' | 'critical';
export type JarvisSeverity = 'info' | 'warn' | 'urgent';
export type JarvisApprovalStatus =
  | 'pending' | 'one-eye' | 'approved' | 'rejected' | 'expired';

/**
 * Multimodal attachment for {@link JarvisThinkRequest}. Mirrors the
 * kernel's `ThoughtAttachment` shape — base64-encoded image bytes the
 * gateway forwards to a vision-capable Sensor (Claude Opus / Sonnet /
 * Haiku).
 */
export interface JarvisAttachment {
  readonly kind: 'image';
  readonly mediaType:
    | 'image/png'
    | 'image/jpeg'
    | 'image/gif'
    | 'image/webp';
  /** Base64-encoded image bytes (NO data-URL prefix). */
  readonly data: string;
  /** Optional filename / caption used for audit + UI display. */
  readonly caption?: string;
}

export interface JarvisThinkRequest {
  readonly threadId: string;
  readonly userMessage: string;
  readonly tier?: JarvisTier;
  readonly stakes?: JarvisStakes;
  readonly requireJudge?: boolean;
  /**
   * Optional multimodal attachments (lease scans, property photos,
   * damage assessment images). The gateway enforces a per-turn cap of
   * 10 attachments and a per-attachment cap of 4 MB base64-decoded.
   */
  readonly attachments?: ReadonlyArray<JarvisAttachment>;
}

export interface JarvisDecision {
  readonly kind: 'answer' | 'softened' | 'refusal';
  readonly text?: string;
  readonly hedge?: string;
  readonly reason?: string;
  readonly confidence?: {
    readonly groundedness: number;
    readonly stability: number;
    readonly review: number;
    readonly numericalConsistency: number;
    readonly overall: number;
  };
  readonly citations?: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly confidence: number;
  }>;
  readonly provenance: {
    readonly thoughtId: string;
    readonly sensorId: string;
    readonly modelId: string;
    readonly latencyMs: number;
    readonly producedAt: string;
  };
}

export interface JarvisThinkResponse {
  readonly success: true;
  readonly surface: string;
  readonly persona: {
    readonly id: string;
    readonly displayName: string;
    readonly firstPersonNoun: string;
  };
  readonly decision: JarvisDecision;
}

export interface JarvisBriefingDataPoint {
  readonly topic: string;
  readonly summary: string;
  readonly severity: JarvisSeverity;
  readonly citationLabel?: string;
}

export interface JarvisBriefingRequest {
  readonly day: string;
  readonly threadId: string;
  readonly dataPoints: ReadonlyArray<JarvisBriefingDataPoint>;
}

export interface JarvisBriefing {
  readonly day: string;
  readonly headline: string;
  readonly bullets: ReadonlyArray<string>;
  readonly decision: JarvisDecision;
}

export interface JarvisProposeActionRequest {
  readonly thoughtId: string;
  readonly summary: string;
  readonly toolName: string;
  readonly payload?: Record<string, unknown>;
  readonly stakes?: 'medium' | 'high' | 'critical';
}

export interface JarvisApprovalSignature {
  readonly approverUserId: string;
  readonly verdict: 'approve' | 'reject';
  readonly comment: string | null;
  readonly signedAt: string;
}

export interface JarvisApprovalRecord {
  readonly action: {
    readonly id: string;
    readonly proposerUserId: string;
    readonly thoughtId: string;
    readonly summary: string;
    readonly toolName: string;
    readonly stakes: 'medium' | 'high' | 'critical';
    readonly proposedAt: string;
    readonly expiresAt: string;
  };
  readonly status: JarvisApprovalStatus;
  readonly signatures: ReadonlyArray<JarvisApprovalSignature>;
}

export interface JarvisSignRequest {
  readonly verdict: 'approve' | 'reject';
  readonly comment?: string;
}

export interface JarvisSurfaceClient {
  readonly surface: JarvisSurface;
  think(req: JarvisThinkRequest): Promise<JarvisThinkResponse>;
  briefing(req: JarvisBriefingRequest): Promise<{ success: true; briefing: JarvisBriefing }>;
  proposeAction(
    req: JarvisProposeActionRequest,
  ): Promise<{ success: true; approval: JarvisApprovalRecord }>;
  sign(
    actionId: string,
    req: JarvisSignRequest,
  ): Promise<{ success: true; approval: JarvisApprovalRecord }>;
  getAction(actionId: string): Promise<{ success: true; approval: JarvisApprovalRecord }>;
  listActions(filter?: {
    status?: JarvisApprovalStatus;
  }): Promise<{ success: true; approvals: ReadonlyArray<JarvisApprovalRecord> }>;
}

const SURFACE_PATH: Record<JarvisSurface, string> = {
  customer: '/api/v1/customer/jarvis',
  owner: '/api/v1/owner/jarvis',
  manager: '/api/v1/manager/jarvis',
  admin: '/api/v1/admin/jarvis',
  platform: '/api/v1/platform/jarvis',
};

/**
 * Build a typed Jarvis client for one surface. The underlying
 * transport is the shared BossnyumbaClient; we call its low-level
 * `request<T>` method (the Jarvis routes aren't yet codegen'd into
 * the OpenAPI `paths` shape so the typed helpers can't reach them).
 */
export function createJarvisClient(
  client: BossnyumbaClient,
  surface: JarvisSurface,
): JarvisSurfaceClient {
  const root = SURFACE_PATH[surface];

  return {
    surface,
    async think(req) {
      return client.request<JarvisThinkResponse>({
        method: 'POST',
        path: `${root}/think`,
        body: req,
      });
    },
    async briefing(req) {
      return client.request<{ success: true; briefing: JarvisBriefing }>({
        method: 'POST',
        path: `${root}/briefing`,
        body: req,
      });
    },
    async proposeAction(req) {
      return client.request<{ success: true; approval: JarvisApprovalRecord }>({
        method: 'POST',
        path: `${root}/actions`,
        body: req,
      });
    },
    async sign(actionId, req) {
      return client.request<{ success: true; approval: JarvisApprovalRecord }>({
        method: 'POST',
        path: `${root}/actions/${encodeURIComponent(actionId)}/sign`,
        body: req,
      });
    },
    async getAction(actionId) {
      return client.request<{ success: true; approval: JarvisApprovalRecord }>({
        method: 'GET',
        path: `${root}/actions/${encodeURIComponent(actionId)}`,
      });
    },
    async listActions(filter) {
      const args: Parameters<BossnyumbaClient['request']>[0] = {
        method: 'GET',
        path: `${root}/actions`,
      };
      if (filter?.status) args.query = { status: filter.status };
      return client.request<{ success: true; approvals: ReadonlyArray<JarvisApprovalRecord> }>(args);
    },
  };
}
