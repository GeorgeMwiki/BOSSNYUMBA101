import type { Mineral } from '@/types/listing'
import type { SortKey } from '@/api/marketplace'
import type { ChipOption } from '@/components/ChipGroup'

// NOTE (flagged): `mineralOptionsKeys` + `mineralGlyph` + the
// `minerals.${value}` i18n keys are keyed on the shared wire `Mineral`
// type; they keep legacy names pending the coordinated type + i18n
// rename to PropertyType. The region list below is now property-domain.
export const mineralOptionsKeys: readonly Mineral[] = [
  'gold_concentrate',
  'tanzanite_rough',
  'coltan',
  'copper_concentrate',
  'gemstone_mixed',
  'gold_dore',
  'tin_cassiterite',
  'silver_concentrate'
] as const

export const regionOptionsKeys: readonly string[] = [
  'Dar es Salaam',
  'Arusha',
  'Mwanza',
  'Dodoma',
  'Mbeya',
  'Zanzibar'
] as const

export function buildMineralOptions(translate: (key: string) => string): readonly ChipOption<Mineral>[] {
  return mineralOptionsKeys.map((value) => ({ value, label: translate(`minerals.${value}`) }))
}

export function buildRegionOptions(): readonly ChipOption<string>[] {
  return regionOptionsKeys.map((value) => ({ value, label: value }))
}

export const sortOptions: readonly { readonly value: SortKey; readonly key: string }[] = [
  { value: 'newest', key: 'marketplace.sort_newest' },
  { value: 'price_asc', key: 'marketplace.sort_price_asc' },
  { value: 'price_desc', key: 'marketplace.sort_price_desc' },
  { value: 'grade', key: 'marketplace.sort_grade' }
] as const

export const mineralGlyph: Readonly<Record<Mineral, string>> = {
  gold_concentrate: 'Au',
  tanzanite_rough: 'Tz',
  coltan: 'Ta',
  copper_concentrate: 'Cu',
  gemstone_mixed: 'Gm',
  gold_dore: 'Au',
  tin_cassiterite: 'Sn',
  silver_concentrate: 'Ag'
}
