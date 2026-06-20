/**
 * Worker certifications recognised by the BossNyumba onboarding wizard.
 *
 * The literal id values are property-trade certifications. They are shared with
 * `src/onboarding/state.ts` (zod enum) and the intelligence test fixture, and
 * each id resolves to a property-domain label via `certLabel()` against the
 * i18n `onboarding.certifications.*` bundle. Keep this list in sync with the
 * onboarding state schema and the cert-label switch.
 */
export const CERTIFICATIONS = [
  'property-manager-licence',
  'real-estate-agent-licence',
  'hvac-technician',
  'electrician-class-b',
  'first-aid',
  'plumber',
  'confined-space'
] as const

export type Certification = (typeof CERTIFICATIONS)[number]

export function isCertification(value: unknown): value is Certification {
  return typeof value === 'string' && (CERTIFICATIONS as readonly string[]).includes(value)
}
