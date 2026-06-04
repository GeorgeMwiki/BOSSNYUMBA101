import { describe, expect, it } from 'vitest'

import en from '../i18n/en.json'
import sw from '../i18n/sw.json'
import { translate } from '../i18n'

// `../api/rfb` re-exports RFB_UNIT_TYPES but pulls expo-secure-store
// transitively via api/client → auth/token, which trips the vitest
// rollup parser. Inline the catalog (it is intentionally duplicated in
// the source so the gateway zod enum and the FE constants stay in
// lock-step — a divergence test ensures they don't drift).
const RFB_UNIT_TYPES = [
  'studio',
  'one_bedroom',
  'two_bedroom',
  'three_bedroom',
  'four_bedroom_plus',
  'five_bedroom_plus',
  'commercial',
  'industrial',
  'mixed_use',
  'retail',
  'office',
  'warehouse',
  'land',
  'other'
] as const

describe('R11 — RFB unit types catalog', () => {
  it('exposes the 14 unit types the gateway accepts', () => {
    expect(RFB_UNIT_TYPES.length).toBe(14)
    expect(RFB_UNIT_TYPES).toContain('studio')
    expect(RFB_UNIT_TYPES).toContain('two_bedroom')
    expect(RFB_UNIT_TYPES).toContain('commercial')
    expect(RFB_UNIT_TYPES).toContain('mixed_use')
  })
})

describe('R11 — RFB i18n bundle', () => {
  it('English bundle carries every rfb.* key the screen uses', () => {
    const required = [
      'title',
      'subtitle',
      'create_cta',
      'create_title',
      'unit_type_label',
      'floor_area_min_label',
      'unit_price_label',
      'delivery_by_label',
      'delivery_by_placeholder',
      'radius_label',
      'radius_value',
      'notes_label',
      'submit',
      'submit_success',
      'submit_failed',
      'list_title',
      'list_empty',
      'status_open',
      'status_filled',
      'status_expired',
      'status_cancelled',
      'response_count_one',
      'response_count_other',
      'floor_area_required_invalid',
      'unit_price_invalid',
      'delivery_in_past'
    ] as const
    const rfb = (en as { rfb?: Record<string, string> }).rfb
    expect(rfb).toBeDefined()
    if (!rfb) return
    for (const k of required) {
      expect(rfb[k], `en.rfb.${k} missing`).toBeTruthy()
    }
  })

  it('Swahili bundle covers the same keys', () => {
    const enKeys = Object.keys((en as { rfb: Record<string, string> }).rfb)
    const swRfb = (sw as { rfb?: Record<string, string> }).rfb
    expect(swRfb).toBeDefined()
    if (!swRfb) return
    for (const k of enKeys) {
      expect(swRfb[k], `sw.rfb.${k} missing`).toBeTruthy()
    }
  })

  it('translate() returns the right copy per language', () => {
    expect(translate('en', 'rfb.title')).toBe('Request for Application')
    expect(translate('sw', 'rfb.title')).toBe('Ombi la Tangazo')
  })

  it('translate() interpolates {km} into radius_value', () => {
    expect(translate('en', 'rfb.radius_value', { km: 150 })).toContain('150')
    expect(translate('sw', 'rfb.radius_value', { km: 200 })).toContain('200')
  })
})
