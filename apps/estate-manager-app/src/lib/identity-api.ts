/**
 * Typed gateway helpers for the cross-org identity surface (#12).
 *
 * Backs the operator "Org & Invites" screen against the REAL identity routes
 * on `services/api-gateway/src/routes/identity.hono.ts`:
 *
 *   POST   /identity/invites                 generate a code (admin)
 *   GET    /identity/invites                 list codes for caller org
 *   POST   /identity/invites/:code/revoke    revoke a code   (admin)
 *   POST   /identity/invites/redeem          redeem a code → membership
 *   GET    /identity/memberships?identityId  list memberships (tenant-scoped)
 *   POST   /identity/memberships/:id/leave   leave a membership
 *   POST   /identity/memberships/:id/block   block a membership (admin)
 *
 * Tenant scope is derived server-side from the Supabase bearer (JWT) — the
 * client never sends a tenantId. The bearer is attached automatically by the
 * api-client request interceptor wired in ApiProvider.
 *
 * `getApiClient` is re-typed through the source `ApiClient` to dodge the
 * barrel namespace/type drift (same convention as maintenance-api.ts).
 */

import { getApiClient } from '@bossnyumba/api-client';
import type { ApiClient } from '@bossnyumba/api-client/client-types';

function client(): ApiClient {
  return getApiClient() as unknown as ApiClient;
}

export type OrgMembershipStatus = 'ACTIVE' | 'LEFT' | 'BLOCKED';

export interface InviteCodeRecord {
  readonly code: string;
  readonly organizationId: string;
  readonly platformTenantId: string;
  readonly issuedBy: string;
  readonly issuedAt: string;
  readonly expiresAt: string | null;
  readonly maxRedemptions: number | null;
  readonly redemptionsUsed: number;
  readonly defaultRoleId: string;
}

export interface OrgMembership {
  readonly id: string;
  readonly tenantIdentityId: string;
  readonly organizationId: string;
  readonly platformTenantId: string;
  readonly userId: string;
  readonly status: OrgMembershipStatus;
  readonly nickname: string | null;
  readonly joinedViaInviteCode: string | null;
  readonly joinedAt: string;
}

export interface GenerateInviteInput {
  readonly defaultRoleId: string;
  readonly maxRedemptions?: number;
  readonly expiresAt?: string;
}

export interface RedeemInviteInput {
  readonly code: string;
  readonly tenantIdentityId: string;
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function listInvites(): Promise<ReadonlyArray<InviteCodeRecord>> {
  const res = await client().get<{ invites: InviteCodeRecord[] }>(
    '/identity/invites',
  );
  return res.data?.invites ?? [];
}

export async function generateInvite(
  input: GenerateInviteInput,
): Promise<InviteCodeRecord> {
  const res = await client().post<{ invite: InviteCodeRecord }>(
    '/identity/invites',
    {
      defaultRoleId: input.defaultRoleId,
      maxRedemptions:
        typeof input.maxRedemptions === 'number' && input.maxRedemptions > 0
          ? input.maxRedemptions
          : undefined,
      expiresAt:
        input.expiresAt && input.expiresAt.length > 0
          ? input.expiresAt
          : undefined,
    },
  );
  return res.data.invite;
}

export async function revokeInvite(code: string): Promise<InviteCodeRecord> {
  const res = await client().post<{ invite: InviteCodeRecord }>(
    `/identity/invites/${encodeURIComponent(code)}/revoke`,
  );
  return res.data.invite;
}

export async function redeemInvite(
  input: RedeemInviteInput,
): Promise<OrgMembership> {
  const res = await client().post<{ membership: OrgMembership }>(
    '/identity/invites/redeem',
    { code: input.code, tenantIdentityId: input.tenantIdentityId },
  );
  return res.data.membership;
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

export async function listMemberships(
  identityId: string,
): Promise<ReadonlyArray<OrgMembership>> {
  const res = await client().get<{ memberships: OrgMembership[] }>(
    '/identity/memberships',
    { params: { identityId } },
  );
  return res.data?.memberships ?? [];
}

export async function leaveMembership(id: string): Promise<OrgMembership> {
  const res = await client().post<{ membership: OrgMembership }>(
    `/identity/memberships/${encodeURIComponent(id)}/leave`,
  );
  return res.data.membership;
}

export async function blockMembership(
  id: string,
  reason: string,
): Promise<OrgMembership> {
  const res = await client().post<{ membership: OrgMembership }>(
    `/identity/memberships/${encodeURIComponent(id)}/block`,
    { reason },
  );
  return res.data.membership;
}
