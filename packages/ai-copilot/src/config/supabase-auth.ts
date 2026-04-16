/**
 * Supabase JWT verification for Brain routes.
 *
 * Verifies access tokens issued by Supabase Auth (HS256, signed with
 * `SUPABASE_JWT_SECRET`) and projects them onto Brain's
 * `AITenantContext` + `AIActor` + `VisibilityViewer` shape.
 *
 * No fakes. Missing or invalid token → throws `SupabaseAuthError`.
 *
 * Token claims convention:
 *   sub                 → user id
 *   email               → optional
 *   user_metadata.tenant_id (or app_metadata.tenant_id)
 *   user_metadata.tenant_name
 *   user_metadata.roles  (or app_metadata.roles): string[]
 *   user_metadata.team_ids: string[]
 *   user_metadata.employee_id: string
 *
 * In Supabase, tenant assignment is typically managed via `app_metadata`
 * (set server-side; immutable from client). We honor both metadata maps but
 * prefer `app_metadata` when both are present.
 */

import { jwtVerify, type JWTPayload } from 'jose';
import { z } from 'zod';

export interface BrainAuthPrincipal {
  /** Raw JWT subject. */
  userId: string;
  email?: string;
  tenantId: string;
  tenantName?: string;
  environment: 'production' | 'staging' | 'development';
  roles: string[];
  teamIds: string[];
  employeeId?: string;
  /** Original JWT payload — kept for audit/forensics. */
  raw: JWTPayload;
}

export class SupabaseAuthError extends Error {
  readonly kind = 'SupabaseAuthError' as const;
  readonly status: 401 | 403;
  constructor(message: string, status: 401 | 403 = 401) {
    super(message);
    this.name = 'SupabaseAuthError';
    this.status = status;
  }
}

const MetadataSchema = z
  .object({
    tenant_id: z.string().optional(),
    tenant_name: z.string().optional(),
    roles: z.array(z.string()).optional(),
    team_ids: z.array(z.string()).optional(),
    employee_id: z.string().optional(),
    environment: z
      .enum(['production', 'staging', 'development'])
      .optional(),
  })
  .partial();

export interface VerifyOptions {
  /** HS256 secret. From `SUPABASE_JWT_SECRET`. */
  jwtSecret: string;
  /** Default environment if claim is absent. */
  defaultEnvironment?: 'production' | 'staging' | 'development';
}

/**
 * Verify and project a Supabase access token. Throws SupabaseAuthError on
 * any signature, expiry, or claim-shape failure.
 */
export async function verifySupabaseJwt(
  token: string,
  opts: VerifyOptions
): Promise<BrainAuthPrincipal> {
  if (!token || typeof token !== 'string') {
    throw new SupabaseAuthError('missing_token', 401);
  }
  const secret = new TextEncoder().encode(opts.jwtSecret);
  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    payload = verified.payload;
  } catch (err) {
    throw new SupabaseAuthError(
      `invalid_token: ${err instanceof Error ? err.message : String(err)}`,
      401
    );
  }

  const userId = String(payload.sub ?? '');
  if (!userId) throw new SupabaseAuthError('missing_subject', 401);

  // Supabase puts the metadata in either `app_metadata` (server-managed) or
  // `user_metadata` (client-modifiable). app_metadata wins.
  const appMd = MetadataSchema.safeParse(
    (payload as Record<string, unknown>).app_metadata ?? {}
  );
  const userMd = MetadataSchema.safeParse(
    (payload as Record<string, unknown>).user_metadata ?? {}
  );
  const app = appMd.success ? appMd.data : {};
  const user = userMd.success ? userMd.data : {};
  const md = { ...user, ...app }; // app overrides user

  const tenantId = md.tenant_id;
  if (!tenantId) {
    throw new SupabaseAuthError(
      'missing_tenant: user has no tenant_id in app_metadata or user_metadata',
      403
    );
  }

  return {
    userId,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    tenantId,
    tenantName: md.tenant_name,
    environment: md.environment ?? opts.defaultEnvironment ?? 'production',
    roles: md.roles ?? [],
    teamIds: md.team_ids ?? [],
    employeeId: md.employee_id,
    raw: payload,
  };
}

/**
 * Extract the bearer token from an Authorization header.
 */
export function extractBearer(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const m = headerValue.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Project a verified principal into the Brain's `AITenantContext` /
 * `AIActor` / `VisibilityViewer` triple.
 */
export function principalToBrainContexts(p: BrainAuthPrincipal): {
  tenant: {
    tenantId: string;
    tenantName: string;
    environment: 'production' | 'staging' | 'development';
  };
  actor: {
    type: 'user';
    id: string;
    email?: string;
    roles: string[];
  };
  viewer: {
    userId: string;
    roles: string[];
    teamIds: string[];
    employeeId?: string;
    isAdmin: boolean;
    isManagement: boolean;
  };
} {
  const isAdmin = p.roles.includes('admin');
  const isManagement =
    isAdmin ||
    p.roles.includes('manager') ||
    p.roles.includes('team_leader');
  return {
    tenant: {
      tenantId: p.tenantId,
      tenantName: p.tenantName ?? p.tenantId,
      environment: p.environment,
    },
    actor: {
      type: 'user',
      id: p.userId,
      email: p.email,
      roles: p.roles,
    },
    viewer: {
      userId: p.userId,
      roles: p.roles,
      teamIds: p.teamIds,
      employeeId: p.employeeId,
      isAdmin,
      isManagement,
    },
  };
}

// ---------------------------------------------------------------------------
// Visibility scope authorization
// ---------------------------------------------------------------------------

export type VisibilityRequest = 'private' | 'team' | 'management' | 'public';

/**
 * Decide whether a principal is authorized to publish at a requested
 * visibility scope. Used by Brain routes to clamp client-supplied
 * `defaultVisibility` so an employee cannot promote a coworker thread to
 * `management` without permission.
 *
 * Rules:
 *  - Admin: anything.
 *  - Manager / team_leader: private | team | management.
 *  - Employee (no special role): private | team only.
 *  - Anyone explicitly requesting `public` requires admin or a tenant-level
 *    "publish_public" role — `public` is the broadcast tier and rarely
 *    appropriate for a single-thread message.
 */
export function maxPermittedVisibility(
  p: Pick<BrainAuthPrincipal, 'roles'>
): VisibilityRequest {
  if (p.roles.includes('admin') || p.roles.includes('publish_public'))
    return 'public';
  if (p.roles.includes('manager') || p.roles.includes('team_leader'))
    return 'management';
  return 'team';
}

const SCOPE_ORDER: Record<VisibilityRequest, number> = {
  private: 0,
  team: 1,
  management: 2,
  public: 3,
};

export function clampVisibility(
  requested: VisibilityRequest | undefined,
  p: Pick<BrainAuthPrincipal, 'roles'>
): VisibilityRequest {
  const cap = maxPermittedVisibility(p);
  if (!requested) return 'private';
  return SCOPE_ORDER[requested] <= SCOPE_ORDER[cap] ? requested : cap;
}
