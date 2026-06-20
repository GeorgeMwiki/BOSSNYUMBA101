import { describe, expect, it, vi } from 'vitest'

/**
 * Tests for PreviewBanner — copy + testID contract per kind.
 *
 * The staff-mobile vitest config runs in a Node environment with no
 * React Native renderer and no JSX runtime in scope (see vitest.config.ts +
 * theme.test.ts pattern). The component itself relies on the Expo babel
 * preset at app build time; under vitest we can only import the module and
 * read its exported data contract. Each render path is therefore exercised
 * indirectly: BANNER_COPY[kind] is what the component pipes into the View,
 * and `preview-banner-${kind}` is the literal testID it sets — both are
 * asserted verbatim per kind below.
 */

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  Text: 'Text',
  View: 'View'
}))

vi.mock('../i18n/useI18n', () => ({
  useI18n: () => ({ lang: 'en', t: {}, screen: () => ({ title: '', intent: '' }) })
}))

import { BANNER_COPY, bannerCopy, type PreviewBannerKind } from '../components/PreviewBanner'

function expectedTestId(kind: PreviewBannerKind): string {
  return `preview-banner-${kind}`
}

describe('PreviewBanner — env-missing', () => {
  it('renders the env-missing copy and testID preview-banner-env-missing', () => {
    expect(BANNER_COPY['env-missing'].sw).toBe(
      'BossNyumba haijaunganishwa na seva. Wasiliana na msimamizi.'
    )
    expect(BANNER_COPY['env-missing'].en).toBe('BossNyumba is not connected to the backend.')
    expect(expectedTestId('env-missing')).toBe('preview-banner-env-missing')
  })
})

describe('PreviewBanner — no-data', () => {
  it('renders the no-data copy and testID preview-banner-no-data', () => {
    expect(BANNER_COPY['no-data'].sw).toBe('Hakuna data bado kwa akaunti yako.')
    expect(BANNER_COPY['no-data'].en).toBe('No data yet on your account.')
    expect(expectedTestId('no-data')).toBe('preview-banner-no-data')
  })
})

describe('PreviewBanner — offline', () => {
  it('renders the offline copy and testID preview-banner-offline', () => {
    expect(BANNER_COPY.offline.sw).toBe('Uko nje ya mtandao. Tutasync ukirudi.')
    expect(BANNER_COPY.offline.en).toBe("You are offline. We'll sync when you reconnect.")
    expect(expectedTestId('offline')).toBe('preview-banner-offline')
  })
})

/**
 * Absolute language-toggle detector: `bannerCopy` MUST resolve to exactly
 * ONE locale's string — never a stacked "sw — en". This is the live guard
 * that the banner no longer renders both languages at once.
 */
describe('bannerCopy — single locale only', () => {
  const kinds: ReadonlyArray<PreviewBannerKind> = ['env-missing', 'no-data', 'offline']

  it('returns the English string verbatim when lang=en (no Swahili)', () => {
    for (const kind of kinds) {
      const out = bannerCopy(kind, 'en')
      expect(out).toBe(BANNER_COPY[kind].en)
      expect(out).not.toContain(BANNER_COPY[kind].sw)
      expect(out).not.toContain(' — ')
      expect(out).not.toContain(' / ')
    }
  })

  it('returns the Swahili string verbatim when lang=sw (no English)', () => {
    for (const kind of kinds) {
      const out = bannerCopy(kind, 'sw')
      expect(out).toBe(BANNER_COPY[kind].sw)
      expect(out).not.toContain(BANNER_COPY[kind].en)
    }
  })
})
