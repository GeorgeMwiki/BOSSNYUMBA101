import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { SectionHeader } from '@/components/SectionHeader'
import { ListingCard } from '@/marketplace/ListingCard'
import { selectRecommended } from '@/marketplace/home/derivations'
import { colors } from '@/theme/colors'
import { spacing, typography } from '@/theme/spacing'
import type { Listing, PropertyType } from '@/types/listing'
import { MarketplaceListingsResultSchema, type MarketplaceListing } from '../toolPayloads'

export interface RecommendedListingsCardProps {
  readonly payload: unknown
  readonly translate: (key: string) => string
}

// `marketplace.recommended` tool. We delegate ranking to the existing
// pure `selectRecommended` helper so the chat card and a future grid
// surface share one sort definition.

export function RecommendedListingsCard({ payload, translate }: RecommendedListingsCardProps) {
  const router = useRouter()
  const parsed = MarketplaceListingsResultSchema.safeParse(payload)
  if (!parsed.success) {
    return null
  }
  const listings = parsed.data.listings.map(toListing)
  const ranked = selectRecommended(listings, 5)
  if (ranked.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{translate('marketplace.empty')}</Text>
      </View>
    )
  }
  return (
    <View style={styles.wrap}>
      <SectionHeader title={translate('marketplace.title')} subtitle={translate('marketplace.subtitle')} />
      {ranked.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          onPress={() => router.push(`/marketplace/${listing.id}`)}
          translate={translate}
        />
      ))}
    </View>
  )
}

function toListing(raw: MarketplaceListing): Listing {
  return {
    id: raw.id,
    propertyType: raw.propertyType as PropertyType,
    title: raw.title,
    grade: raw.grade,
    floorAreaSqm: raw.floorAreaSqm,
    propertyAddress: raw.propertyAddress,
    originRegion: raw.originRegion,
    landlord: {
      id: raw.landlord.id,
      name: raw.landlord.name,
      licenceNumber: raw.landlord.licenceNumber,
      rating: raw.landlord.rating,
      verified: raw.landlord.verified
    },
    rentPerMonthTzs: raw.rentPerMonthTzs,
    priceHintTzs: raw.priceHintTzs,
    photos: raw.photos,
    inspectionReportUrl: raw.inspectionReportUrl,
    inspectionResults: [],
    ownershipHistory: raw.ownershipHistory,
    listedAt: raw.listedAt,
    status: raw.status
  }
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  empty: { paddingVertical: spacing.md },
  emptyText: { ...typography.caption, color: colors.inkMuted }
})
