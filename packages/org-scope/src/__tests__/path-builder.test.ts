import { describe, expect, it } from 'vitest';
import {
  buildChildPath,
  buildTenantRootPath,
  isDescendantPath,
  slugify,
} from '../hierarchy/path-builder.js';

describe('path-builder', () => {
  describe('slugify', () => {
    it('lowercases + dashes non-alphanumerics', () => {
      expect(slugify('Geita Mining Co.')).toBe('geita-mining-co');
    });

    it('returns "_" for empty input', () => {
      expect(slugify('')).toBe('_');
    });

    it('returns "_" for all-punctuation input', () => {
      expect(slugify('!!!')).toBe('_');
    });

    it('trims trailing dashes', () => {
      expect(slugify('hello!')).toBe('hello');
    });
  });

  describe('buildChildPath', () => {
    it('builds top-level path from tenant slug', () => {
      expect(buildChildPath('bossnyumba-tz', null, 'North Zone')).toBe('bossnyumba-tz/north-zone');
    });

    it('appends to parent path', () => {
      expect(buildChildPath('bossnyumba-tz', 'bossnyumba-tz/north-zone', 'Geita')).toBe(
        'bossnyumba-tz/north-zone/geita',
      );
    });
  });

  describe('buildTenantRootPath', () => {
    it('returns slugged tenant id', () => {
      expect(buildTenantRootPath('BossNyumba TZ')).toBe('bossnyumba-tz');
    });
  });

  describe('isDescendantPath', () => {
    it('matches exact', () => {
      expect(isDescendantPath('bossnyumba/geita', 'bossnyumba/geita')).toBe(true);
    });

    it('matches descendant', () => {
      expect(isDescendantPath('bossnyumba/geita/site-a', 'bossnyumba/geita')).toBe(true);
    });

    it('rejects sibling with prefix overlap', () => {
      expect(isDescendantPath('bossnyumba/geita-2', 'bossnyumba/geita')).toBe(false);
    });

    it('rejects unrelated paths', () => {
      expect(isDescendantPath('bossnyumba/mererani', 'bossnyumba/geita')).toBe(false);
    });
  });
});
