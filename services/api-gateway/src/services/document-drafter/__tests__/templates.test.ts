/**
 * Real-estate template contract tests — Wave UNIVERSAL-DOC-DRAFTER.
 *
 * Each template must validate its variables with zod and produce
 * deterministic, bilingual-capable markdown.
 */

import { describe, expect, it } from 'vitest';

import {
  UNIVERSAL_TEMPLATES,
  findUniversalTemplate,
  listUniversalTemplates,
} from '../templates/universal-registry.js';
import { leaseAgreementTemplate } from '../templates/lease-agreement.template.js';
import { rentIncreaseNoticeTemplate } from '../templates/rent-increase-notice.template.js';
import { evictionNoticeTemplate } from '../templates/eviction-notice.template.js';
import { vendorRfpTemplate } from '../templates/vendor-rfp.template.js';
import { tenantWelcomeLetterTemplate } from '../templates/tenant-welcome-letter.template.js';
import { boardResolutionTemplate } from '../templates/board-resolution.template.js';
import { memoInternalTemplate } from '../templates/memo-internal.template.js';

describe('universal template registry', () => {
  it('exports exactly 7 unique templates', () => {
    expect(UNIVERSAL_TEMPLATES).toHaveLength(7);
    const ids = new Set(UNIVERSAL_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(7);
  });

  it('every template carries bilingual sw/en titles', () => {
    for (const t of UNIVERSAL_TEMPLATES) {
      expect(t.title.en.length).toBeGreaterThan(0);
      expect(t.title.sw.length).toBeGreaterThan(0);
    }
  });

  it('listUniversalTemplates returns id/title/kind/description tuples', () => {
    const list = listUniversalTemplates();
    expect(list).toHaveLength(7);
    expect(list[0]).toMatchObject({
      id: expect.any(String),
      title: expect.objectContaining({ en: expect.any(String), sw: expect.any(String) }),
      kind: expect.any(String),
      description: expect.any(String),
    });
  });

  it('findUniversalTemplate returns the template by id or undefined', () => {
    expect(findUniversalTemplate('lease-agreement')).toBe(leaseAgreementTemplate);
    expect(findUniversalTemplate('does-not-exist')).toBeUndefined();
  });
});

describe('lease-agreement template', () => {
  const baseVars = {
    landlordName: 'Asha Properties Ltd',
    landlordAddress: 'P.O. Box 123, Dar es Salaam',
    tenantName: 'John Mwakikoti',
    premisesAddress: '12 Bahari Heights, Kinondoni',
    unitDescriptor: 'Apartment 4B, 2-bedroom',
    termMonths: 12,
    startDate: '2026-07-01',
    monthlyRentAmount: 800000,
    currencyCode: 'TZS',
  };

  it('renders Swahili lease body', async () => {
    const md = await leaseAgreementTemplate.composeMarkdown(baseVars, {
      language: 'sw',
    });
    expect(md).toContain('MKATABA WA KUPANGA NYUMBA');
    expect(md).toContain('Mwenye Nyumba');
    expect(md).toContain('Mpangaji');
    expect(md).toContain('TZS 800,000');
  });

  it('renders English lease body', async () => {
    const md = await leaseAgreementTemplate.composeMarkdown(baseVars, {
      language: 'en',
    });
    expect(md).toContain('RESIDENTIAL LEASE AGREEMENT');
    expect(md).toContain('Landlord');
    expect(md).toContain('Tenant');
    expect(md).toContain('TZS 800,000');
  });

  it('rejects invalid currency code length', () => {
    expect(() =>
      leaseAgreementTemplate.composeMarkdown(
        { ...baseVars, currencyCode: 'INVALID' },
        { language: 'en' },
      ),
    ).toThrow();
  });
});

describe('rent-increase-notice template', () => {
  const baseVars = {
    tenantName: 'Mpangaji Mmoja',
    unitDescriptor: 'Studio 3A',
    premisesAddress: '5 Mwananchi Court, Mwanza',
    currentRentAmount: 200000,
    newRentAmount: 230000,
    effectiveDate: '2026-08-01',
    landlordName: 'Mwananchi Estates',
  };

  it('computes the percentage delta', async () => {
    const md = await rentIncreaseNoticeTemplate.composeMarkdown(baseVars, {
      language: 'en',
    });
    expect(md).toContain('15.0%');
    expect(md).toContain('TZS 230,000');
  });

  it('renders the Swahili variant', async () => {
    const md = await rentIncreaseNoticeTemplate.composeMarkdown(baseVars, {
      language: 'sw',
    });
    expect(md).toContain('TAARIFA YA KUONGEZA KODI');
  });
});

describe('eviction-notice template', () => {
  const baseVars = {
    tenantName: 'Tenant Name',
    unitDescriptor: 'Apartment 2C',
    premisesAddress: 'Estate Address',
    vacateByDate: '2026-08-01',
    reason: 'arrears' as const,
    arrearsAmount: 1600000,
    arrearsMonths: 2,
    landlordName: 'Landlord Name',
    jurisdiction: 'TZ',
  };

  it('renders arrears grounds + amount in English', async () => {
    const md = await evictionNoticeTemplate.composeMarkdown(baseVars, {
      language: 'en',
    });
    expect(md).toContain('NOTICE TO VACATE');
    expect(md).toContain('non-payment of rent');
    expect(md).toContain('TZS 1,600,000');
  });

  it('renders Swahili variant with grounds translation', async () => {
    const md = await evictionNoticeTemplate.composeMarkdown(baseVars, {
      language: 'sw',
    });
    expect(md).toContain('TAARIFA YA KUONDOKA');
    expect(md).toContain('kushindwa kulipa kodi');
  });

  it('supports lease_breach grounds', async () => {
    const md = await evictionNoticeTemplate.composeMarkdown(
      { ...baseVars, reason: 'lease_breach' },
      { language: 'en' },
    );
    expect(md).toContain('breach of lease terms');
  });
});

describe('vendor-rfp template', () => {
  const baseVars = {
    rfpNumber: 'RFP-2026-001',
    serviceCategory: 'cleaning' as const,
    scope: 'Daily common-area cleaning, weekly deep clean of stairwells.',
    estateName: 'Bahari Heights',
    numberOfUnits: 24,
    durationMonths: 12,
    responseDeadline: '2026-06-15',
    contractStartDate: '2026-07-01',
    contactName: 'Estate Manager',
    contactEmail: 'manager@example.com',
  };

  it('renders required RFP sections in English', async () => {
    const md = await vendorRfpTemplate.composeMarkdown(baseVars, {
      language: 'en',
    });
    expect(md).toContain('REQUEST FOR PROPOSAL');
    expect(md).toContain('RFP-2026-001');
    expect(md).toContain('Scope of Work');
    expect(md).toContain('Evaluation Criteria');
  });

  it('uses default evaluation criteria when none supplied', async () => {
    const md = await vendorRfpTemplate.composeMarkdown(baseVars, {
      language: 'en',
    });
    expect(md).toContain('Price and value for money');
  });

  it('renders Swahili variant', async () => {
    const md = await vendorRfpTemplate.composeMarkdown(baseVars, {
      language: 'sw',
    });
    expect(md).toContain('OMBI LA BEI');
  });

  it('rejects an invalid email', () => {
    expect(() =>
      vendorRfpTemplate.composeMarkdown(
        { ...baseVars, contactEmail: 'not-an-email' },
        { language: 'en' },
      ),
    ).toThrow();
  });
});

describe('tenant-welcome-letter template', () => {
  const baseVars = {
    tenantName: 'Mary K.',
    unitDescriptor: 'Apartment 1A',
    premisesAddress: 'Estate X',
    moveInDate: '2026-06-01',
    caretakerName: 'Juma',
    caretakerPhone: '+255712345678',
    monthlyRentAmount: 500000,
    paymentMobileMoneyTill: '123456',
    landlordName: 'Landlord Co',
  };

  it('renders welcome copy in Swahili with caretaker contact', async () => {
    const md = await tenantWelcomeLetterTemplate.composeMarkdown(baseVars, {
      language: 'sw',
    });
    expect(md).toContain('KARIBU');
    expect(md).toContain('Mlinzi');
    expect(md).toContain('+255712345678');
  });

  it('skips mobile-money line when not provided', async () => {
    const { paymentMobileMoneyTill: _drop, ...rest } = baseVars;
    void _drop;
    const md = await tenantWelcomeLetterTemplate.composeMarkdown(rest, {
      language: 'en',
    });
    expect(md).not.toContain('mobile money till');
  });
});

describe('board-resolution template', () => {
  const baseVars = {
    companyName: 'Bahari Holdings Ltd',
    resolutionNumber: 'BR-2026-04',
    meetingDate: '2026-05-29',
    resolutionTitle: 'Authorise vendor contract with CleanCo',
    whereasClauses: ['CleanCo has the lowest bid.', 'References are positive.'],
    resolvedClauses: ['Award the contract for 12 months.', 'Authorise the CEO to sign.'],
    directors: [
      { name: 'A. Director', role: 'CEO' },
      { name: 'B. Director', role: 'CFO' },
    ],
  };

  it('renders resolution structure in English', async () => {
    const md = await boardResolutionTemplate.composeMarkdown(baseVars, {
      language: 'en',
    });
    expect(md).toContain('BOARD RESOLUTION');
    expect(md).toContain('WHEREAS');
    expect(md).toContain('RESOLVED THAT');
    expect(md).toContain('A. Director');
  });

  it('renders Swahili variant with AZIMIO header', async () => {
    const md = await boardResolutionTemplate.composeMarkdown(baseVars, {
      language: 'sw',
    });
    expect(md).toContain('AZIMIO LA BODI');
    expect(md).toContain('ILHALI');
    expect(md).toContain('IMEAZIMIWA');
  });
});

describe('memo-internal template', () => {
  it('renders memo with sw labels when language=sw', async () => {
    const md = await memoInternalTemplate.composeMarkdown(
      {
        to: 'Team',
        from: 'CEO',
        subject: 'Q3 plan',
        body: 'Plan details here.',
      },
      { language: 'sw' },
    );
    expect(md).toContain('MEMO YA NDANI');
    expect(md).toContain('Kwa:');
    expect(md).toContain('Kuhusu:');
  });
});
