/**
 * BossNyumba test users — fixed canonical accounts bound to demo tenants.
 *
 * These users back the e2e tests + onboarding screencasts. NEVER use
 * production credentials here. The Supabase user ids are deterministic
 * so test fixtures across the monorepo can reference them by id.
 *
 * Roles mirror BossNyumba's real-estate persona register:
 *   - owner      : landlord / portfolio owner
 *   - manager    : property manager (delegated)
 *   - maintenance: maintenance crew member
 *   - tenant     : occupant (rents a unit)
 *   - applicant  : prospective tenant (browses RFAs, applies)
 *   - admin      : BossNyumba internal admin (super_admin)
 *
 * Bilingual sw/en — `preferredLanguage` per user. The test tenants are
 * keyed by region so RLS isolation tests can mix multi-tenant fixtures
 * without colliding on (email, tenant_id).
 */

export interface BossNyumbaTestUser {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role:
    | 'owner'
    | 'manager'
    | 'maintenance'
    | 'tenant'
    | 'applicant'
    | 'admin';
  readonly preferredLanguage: 'sw' | 'en' | 'sw-KE';
  readonly tenantSlug: string;
}

export const BOSSNYUMBA_TEST_USERS: readonly BossNyumbaTestUser[] = [
  {
    id: 'test-user-owner-bossnyumba',
    email: 'owner@bossnyumba.test',
    fullName: 'Owner Test',
    role: 'owner',
    preferredLanguage: 'sw',
    tenantSlug: 'demo-t3-za-jhb-bellaroma',
  },
  {
    id: 'test-user-manager-bossnyumba',
    email: 'manager@bossnyumba.test',
    fullName: 'Manager Test',
    role: 'manager',
    preferredLanguage: 'sw',
    tenantSlug: 'demo-t3-za-jhb-bellaroma',
  },
  {
    id: 'test-user-maintenance-bossnyumba',
    email: 'maintenance@bossnyumba.test',
    fullName: 'Maintenance Crew Test',
    role: 'maintenance',
    preferredLanguage: 'sw',
    tenantSlug: 'demo-t3-za-jhb-bellaroma',
  },
  {
    id: 'test-user-tenant-bossnyumba',
    email: 'tenant@bossnyumba.test',
    fullName: 'Tenant Test',
    role: 'tenant',
    preferredLanguage: 'sw',
    tenantSlug: 'demo-t3-za-jhb-bellaroma',
  },
  {
    id: 'test-user-applicant-bossnyumba',
    email: 'applicant@bossnyumba.test',
    fullName: 'Applicant Test',
    role: 'applicant',
    preferredLanguage: 'sw',
    tenantSlug: 'demo-t3-za-jhb-bellaroma',
  },
  {
    id: 'test-user-admin-bossnyumba',
    email: 'admin@bossnyumba.test',
    fullName: 'BossNyumba Admin',
    role: 'admin',
    preferredLanguage: 'en',
    tenantSlug: 'demo-t1-tz-mwananchi',
  },
];

/**
 * Filter test users by role. Useful for fixtures that only need
 * a particular persona type.
 */
export function findTestUsersByRole(
  role: BossNyumbaTestUser['role'],
): readonly BossNyumbaTestUser[] {
  return BOSSNYUMBA_TEST_USERS.filter((u) => u.role === role);
}
