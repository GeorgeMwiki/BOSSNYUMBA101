import type { Mineral } from '@/types/listing'
import type { SortKey } from '@/api/marketplace'
import type { ChipOption } from '@/components/ChipGroup'

// NOTE (flagged): the `minerals.${value}` i18n key and the `Mineral`
// enum literals below are keyed on the shared wire type; they keep
// their legacy names pending the coordinated type + i18n rename to
// PropertyType. The exported helper/glyph identifiers and the region
// list are property-domain.
export const unitTypeOptionKeys: readonly Mineral[] = [
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

export function buildUnitTypeOptions(translate: (key: string) => string): readonly ChipOption<Mineral>[] {
  return unitTypeOptionKeys.map((value) => ({ value, label: translate(`minerals.${value}`) }))
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
// wire enum literal (flagged above), each value mirrors the property
// label rendered from the `minerals.*` i18n namespace
// (Apartment / Bungalow / Townhouse / Studio / Mixed-use / Penthouse /
// Duplex / Villa).
export const unitTypeGlyph: Readonly<Record<Mineral, string>> = {
  gold_concentrate: 'Apt',
  tanzanite_rough: 'Bng',
  coltan: 'Twn',
  copper_concentrate: 'Std',
  gemstone_mixed: 'Mix',
  gold_dore: 'Pnt',
  tin_cassiterite: 'Dpx',
  silver_concentrate: 'Vil'
}
