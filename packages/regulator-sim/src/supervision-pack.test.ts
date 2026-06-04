/**
 * Supervision-pack tests: all eight required sections, determinism, and the
 * rent-arrears / liquidity-breach status branches.
 */

import { describe, expect, it } from 'vitest';
import {
  SUPERVISION_PACK_REQUIRED_SECTIONS,
  buildSupervisionPack,
  type SupervisionPackInput,
} from './index';

const input: SupervisionPackInput = {
  periodFromIso: '2026-04-01',
  periodToIso: '2026-06-30',
  institution: 'BossNyumba Estate Holdings Ltd',
  portfolioRegistrationNumber: 'PR-2026-0042',
  rentCollectionRatio: 1.0,
  leaseComplianceRatio: 0.97,
  liquidityRatio: 1.2,
  amlAlerts: 4,
  amlClosed: 4,
};

describe('buildSupervisionPack', () => {
  it('produces all eight required sections', () => {
    const pack = buildSupervisionPack(input);
    const titles = pack.documents.map((d) => d.title);
    for (const required of SUPERVISION_PACK_REQUIRED_SECTIONS) {
      expect(titles).toContain(required);
    }
  });

  it('is deterministic for a given input', () => {
    expect(buildSupervisionPack(input).checksum).toBe(
      buildSupervisionPack(input).checksum,
    );
  });

  it('reports rent arrears when collection < 100%', () => {
    const pack = buildSupervisionPack({ ...input, rentCollectionRatio: 0.8 });
    const rent = pack.documents.find((d) => d.title === 'Rent Collection');
    expect(rent?.contents).toMatch(/ARREARS/);
  });

  it('reports a treasury liquidity breach below the minimum', () => {
    const pack = buildSupervisionPack({ ...input, liquidityRatio: 0.5 });
    const liq = pack.documents.find((d) => d.title === 'Treasury Liquidity');
    expect(liq?.contents).toMatch(/BREACH/);
  });

  it('reports a lapsed-lease elevation below the compliance threshold', () => {
    const pack = buildSupervisionPack({ ...input, leaseComplianceRatio: 0.5 });
    const lease = pack.documents.find((d) => d.title === 'Lease Compliance');
    expect(lease?.contents).toMatch(/ELEVATED/);
  });
});
