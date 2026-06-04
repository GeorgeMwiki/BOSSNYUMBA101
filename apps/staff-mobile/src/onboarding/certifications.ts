/**
 * Worker certifications recognised by the BossNyumba onboarding wizard.
 *
 * NOTE: the literal id values below are a legacy identifier set still shared
 * with `src/onboarding/state.ts` (zod enum) and the intelligence test fixture;
 * the user-facing labels are fully property-domain (see i18n
 * `onboarding.certifications.*`). A coordinated rename of these legacy ids to
 * property-trade ids (and a matching shift-planner contract) is flagged for
 * follow-up. Keep this list in sync with the onboarding state schema.
 */
export const CERTIFICATIONS = [
  'haul-truck-license',
  'excavator-license',
  'underground-cert',
  'blaster-permit',
  'first-aid',
  'crusher-operator',
  'electrician-class-b',
  'confined-space'
] as const

export type Certification = (typeof CERTIFICATIONS)[number]

export function isCertification(value: unknown): value is Certification {
  return typeof value === 'string' && (CERTIFICATIONS as readonly string[]).includes(value)
}
