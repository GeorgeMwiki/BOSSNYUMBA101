/**
 * Computer Use — domain allowlist.
 *
 * Anthropic's built-in classifier flags prompt-injection attempts in
 * screenshots, but we still pin which domains the harness may visit.
 *
 * Maps to the L2 audit §1.2 safety guidance.
 */

const DEFAULT_KRA_DOMAINS = ['itax.kra.go.ke', 'tra.go.tz', 'ura.go.ug'];
const DEFAULT_BANK_DOMAINS = [
  'absa.co.ke',
  'co-opbank.co.ke',
  'equitybank.co.ke',
  'kcbgroup.com',
];
const DEFAULT_VENDOR_PORTALS: ReadonlyArray<string> = [];

export const BUILT_IN_DOMAIN_GROUPS: Readonly<
  Record<'kra' | 'banks' | 'vendor-portals', ReadonlyArray<string>>
> = {
  kra: DEFAULT_KRA_DOMAINS,
  banks: DEFAULT_BANK_DOMAINS,
  'vendor-portals': DEFAULT_VENDOR_PORTALS,
};

export function normalizeAllowedDomains(
  domains: ReadonlyArray<string>,
): ReadonlyArray<string> {
  return Array.from(
    new Set(
      domains
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0)
        .map(stripScheme),
    ),
  );
}

function stripScheme(d: string): string {
  return d.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function isDomainAllowed(
  url: string,
  allowed: ReadonlyArray<string>,
): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowed.some(
    (d) =>
      host === d.toLowerCase() ||
      host.endsWith(`.${d.toLowerCase()}`),
  );
}

export class DomainPolicyViolationError extends Error {
  override readonly name = 'DomainPolicyViolationError';
  constructor(public readonly url: string, public readonly allowed: ReadonlyArray<string>) {
    super(`URL ${url} is not in the Computer Use allowlist [${allowed.join(', ')}]`);
  }
}
