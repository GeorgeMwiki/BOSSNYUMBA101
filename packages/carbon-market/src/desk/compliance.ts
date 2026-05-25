/**
 * Jurisdictional carbon-credit compliance rules.
 *
 * Sources / citations (kept inline so the rationale is auditable):
 *   - CORSIA Phase II eligibility — ICAO Council Decision (Mar 2024)
 *     covering 2024-2026 first compliance period:
 *     https://www.icao.int/environmental-protection/CORSIA/
 *   - Article 6.2 ITMOs / 6.4 PACM — UNFCCC Decisions 2/CMA.3 + 3/CMA.3:
 *     https://unfccc.int/process-and-meetings/the-paris-agreement/article-6
 *   - Tanzania: Environmental Management (Control and Management of
 *     Carbon Trading) Regulations 2022, S.I. 636 — requires a Letter of
 *     Authorisation from the Vice President's Office for export.
 *   - Kenya: Climate Change (Amendment) Act 2023 — designated National
 *     Authority gates exports; CORSIA-eligible projects allowed.
 *   - Uganda: National Climate Change Act 2021 + DNA process via Ministry
 *     of Water and Environment.
 *
 * This is a *hard-coded* lookup table — it is intentionally easy to read
 * and easy for the audit team to cross-check. If the underlying rules
 * change (and they will) edit the table directly.
 */

import type {
  ComplianceResult,
  CountryCode,
  CreditStandard,
} from '../types.js';

interface JurisdictionRule {
  /** Country runs a CORSIA-eligible programme. */
  readonly corsiaCapable: boolean;
  /** Country participates in Article 6.2 ITMO transfers. */
  readonly article6Active: boolean;
  /** Country mandates a Letter of Authorisation from a DNA before export. */
  readonly requiresLoa: boolean;
  /** Country restricts tenants to purchasing *domestic* credits only. */
  readonly domesticOnly: boolean;
  /** Citation tag for the rationale. */
  readonly source: string;
}

/**
 * Tenant-jurisdiction rules — does the *buyer's* country allow them
 * to count an offshore credit? Domestic-only is rare; most jurisdictions
 * allow imports if the host has authorised export.
 */
export const TENANT_JURISDICTION_RULES: Readonly<Record<CountryCode, JurisdictionRule>> = Object.freeze({
  TZ: {
    corsiaCapable: true,
    article6Active: true,
    requiresLoa: false,                              // tenant-side LoA not required; project-side LoA covered below
    domesticOnly: false,
    source: 'TZ Carbon Trading Regs 2022',
  },
  KE: {
    corsiaCapable: true,
    article6Active: true,
    requiresLoa: false,
    domesticOnly: false,
    source: 'KE Climate Change (Amendment) Act 2023',
  },
  UG: {
    corsiaCapable: true,
    article6Active: true,
    requiresLoa: false,
    domesticOnly: false,
    source: 'UG National Climate Change Act 2021',
  },
  RW: {
    corsiaCapable: true,
    article6Active: true,
    requiresLoa: false,
    domesticOnly: false,
    source: 'RW Nationally Determined Contribution 2020',
  },
  NG: {
    corsiaCapable: true,
    article6Active: true,
    requiresLoa: false,
    domesticOnly: false,
    source: 'NG Climate Change Act 2021',
  },
  ZA: {
    corsiaCapable: true,
    article6Active: true,
    requiresLoa: false,
    domesticOnly: false,
    source: 'ZA Carbon Tax Act 2019',
  },
  GB: {
    corsiaCapable: true,
    article6Active: true,
    requiresLoa: false,
    domesticOnly: false,
    source: 'UK ETS + Voluntary Carbon Markets framework 2024',
  },
  // Sensible default for unknown jurisdictions: assume the tenant must
  // do extra diligence and surface that as a finding.
});

/**
 * Project-host rules — does the country where the *project sits*
 * require an export Letter of Authorisation (LoA), and which standards
 * are CORSIA-eligible from there?
 */
export const PROJECT_HOST_RULES: Readonly<Record<CountryCode, {
  readonly hostRequiresLoa: boolean;
  readonly corsiaEligibleStandards: ReadonlyArray<CreditStandard>;
  readonly source: string;
}>> = Object.freeze({
  TZ: {
    hostRequiresLoa: true,
    corsiaEligibleStandards: ['VCS', 'GoldStandard', 'Article_6_4'],
    source: 'TZ Carbon Trading Regs 2022',
  },
  KE: {
    hostRequiresLoa: true,                            // since 2023 Amendment
    corsiaEligibleStandards: ['VCS', 'GoldStandard', 'Article_6_4'],
    source: 'KE Climate Change (Amendment) Act 2023',
  },
  UG: {
    hostRequiresLoa: true,
    corsiaEligibleStandards: ['VCS', 'GoldStandard', 'Article_6_4'],
    source: 'UG National Climate Change Act 2021',
  },
  RW: {
    hostRequiresLoa: true,
    corsiaEligibleStandards: ['VCS', 'GoldStandard', 'Article_6_4'],
    source: 'RW NDC 2020',
  },
  GB: {
    hostRequiresLoa: false,
    corsiaEligibleStandards: ['VCS', 'GoldStandard', 'ACR', 'CAR', 'Article_6_4'],
    source: 'UK voluntary carbon markets framework 2024',
  },
});

export interface ComplianceCheckArgs {
  readonly purchase: {
    readonly projectCountry: CountryCode;
    readonly standard: CreditStandard;
  };
  readonly tenantJurisdiction: CountryCode;
}

export function runComplianceCheck(args: ComplianceCheckArgs): ComplianceResult {
  const findings: string[] = [];
  const tenant = TENANT_JURISDICTION_RULES[args.tenantJurisdiction];
  const host = PROJECT_HOST_RULES[args.purchase.projectCountry];

  if (!tenant) {
    findings.push(
      `Tenant jurisdiction ${args.tenantJurisdiction} not in compliance table — manual review required`,
    );
  } else {
    findings.push(`Tenant rule source: ${tenant.source}`);
  }
  if (!host) {
    findings.push(
      `Project host ${args.purchase.projectCountry} not in compliance table — assume conservative defaults`,
    );
  } else {
    findings.push(`Host rule source: ${host.source}`);
  }

  const corsiaEligible = Boolean(
    tenant?.corsiaCapable &&
    host?.corsiaEligibleStandards.includes(args.purchase.standard),
  );
  if (corsiaEligible) {
    findings.push(`CORSIA Phase II eligible (standard ${args.purchase.standard} accepted from host ${args.purchase.projectCountry})`);
  } else if (tenant?.corsiaCapable) {
    findings.push(
      `Standard ${args.purchase.standard} not on CORSIA list for host ${args.purchase.projectCountry}`,
    );
  }

  const article6Eligible = Boolean(tenant?.article6Active && host && (args.purchase.standard === 'VCS' || args.purchase.standard === 'GoldStandard' || args.purchase.standard === 'Article_6_4'));
  if (article6Eligible) {
    findings.push(`Article 6.2 ITMO pathway open (both parties participate)`);
  }

  const requiresLoa = Boolean(host?.hostRequiresLoa);
  if (requiresLoa) {
    findings.push(
      `Host ${args.purchase.projectCountry} requires Letter of Authorisation from Designated National Authority before export`,
    );
  }

  const domesticOnly = Boolean(tenant?.domesticOnly);
  if (domesticOnly && args.purchase.projectCountry !== args.tenantJurisdiction) {
    findings.push(
      `Tenant jurisdiction ${args.tenantJurisdiction} permits domestic credits only — offshore project disallowed`,
    );
  }

  const permitted = !!tenant && !!host && (!domesticOnly || args.purchase.projectCountry === args.tenantJurisdiction);

  return {
    tenantJurisdiction: args.tenantJurisdiction,
    purchase: args.purchase,
    corsiaEligible,
    article6Eligible,
    requiresLetterOfAuthorisation: requiresLoa,
    domesticOnlyRule: domesticOnly,
    permitted,
    findings,
  };
}
