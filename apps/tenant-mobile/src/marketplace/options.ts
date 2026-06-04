import type { PropertyType } from '@/types/listing'
import type { SortKey } from '@/api/marketplace'
import type { ChipOption } from '@/components/ChipGroup'

// Unit-type filter options, keyed on the `PropertyType` domain enum. Labels
// resolve from the `unitTypes.*` i18n namespace. The region list is the
// property-domain neighbourhood set.
export const unitTypeOptionKeys: readonly PropertyType[] = [
  'studio',
  'one_bedroom',
  'two_bedroom',
  'three_bedroom',
  'four_bedroom_plus',
  'commercial',
  'industrial',
  'mixed_use'
] as const

export const regionOptionsKeys: readonly string[] = [
  'Dar es Salaam',
  'Arusha',
  'Mwanza',
  'Dodoma',
  'Mbeya',
  'Zanzibar'
] as const

export function buildUnitTypeOptions(translate: (key: string) => string): readonly ChipOption<PropertyType>[] {
  return unitTypeOptionKeys.map((value) => ({ value, label: translate(`unitTypes.${value}`) }))
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

// Short unit-type glyphs shown on the listing card avatar. Keyed on the
// `PropertyType` enum literal; each value mirrors the property label
// rendered from the `unitTypes.*` i18n namespace.
export const unitTypeGlyph: Readonly<Record<PropertyType, string>> = {
  studio: 'Std',
  one_bedroom: '1Bd',
  two_bedroom: '2Bd',
  three_bedroom: '3Bd',
  four_bedroom_plus: '4Bd',
  commercial: 'Com',
  industrial: 'Ind',
  mixed_use: 'Mix'
}
