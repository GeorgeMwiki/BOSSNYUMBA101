import { useRouter } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Screen } from '@/components/Screen'
import { useTranslation } from '@/hooks/useTranslation'
import { useSession } from '@/auth/session'
import { fetchListings, fetchBids } from '@/api/marketplace'
import { queryKeys } from '@/api/queryKeys'
import { MarketplaceEmptyState } from '@/marketplace/home/MarketplaceEmptyState'
import { BnPageHero, BnButton, greet, tokens } from '@/ui'
import { TrustBalanceStrip } from './sections/TrustBalanceStrip'
import { LiveAuctionLobby } from './sections/LiveAuctionLobby'
import { RecommendedParcels } from './sections/RecommendedParcels'
import { ActiveBidsSection } from './sections/ActiveBidsSection'
import { DealPipelineSection } from './sections/DealPipelineSection'
import { BuyerPerformanceSection } from './sections/BuyerPerformanceSection'

/**
 * Dashibodi — the tenant's at-a-glance dashboard. Six sections compose from
 * the same React Query caches that the marketplace and applications tabs
 * already hydrate, so navigation between tabs is free of redundant network
 * calls. Pure derivations live under `@/marketplace/home/*` so this screen
 * stays presentational and the dashboard / chat / future cards share one
 * truth. NOTE (flagged): the exported `BuyerDashboard` component name keeps
 * its identifier pending a coordinated route + symbol rename.
 */

export function BuyerDashboard() {
  const router = useRouter()
  const { t, lang } = useTranslation()
  const user = useSession()
  const firstName = (user.companyName ?? '').split(' ')[0] ?? null

  const listingsQuery = useQuery({
    queryKey: queryKeys.listings({ sort: 'newest' }),
    queryFn: () => fetchListings({ sort: 'newest' })
  })
  const bidsQuery = useQuery({
    queryKey: queryKeys.bids(),
    queryFn: fetchBids
  })

  if (!user.id) {
    return (
      <Screen>
        <BnPageHero
          eyebrow={t('app.name')}
          title={greet(lang)}
          subtitle={t('dashboard.subtitle')}
        />
        <MarketplaceEmptyState message={t('dashboard.unauthenticated')} tone="warning" />
      </Screen>
    )
  }

  const isInitialLoad =
    (listingsQuery.isLoading && !listingsQuery.data) ||
    (bidsQuery.isLoading && !bidsQuery.data)
  const isFetching = listingsQuery.isFetching || bidsQuery.isFetching
  const isError = listingsQuery.isError || bidsQuery.isError

  const onRefresh = () => {
    void listingsQuery.refetch()
    void bidsQuery.refetch()
  }

  const heroEyebrow = lang === 'sw' ? 'Dashibodi · BossNyumba' : 'Renter dashboard'
  const heroSubtitle = lang === 'sw'
    ? 'Soko la nyumba: nyumba zinazopatikana, maombi yanayofuata, na mwenendo wa kodi.'
    : 'Property marketplace — available units, your applications, and rent trends.'

  const renderHero = (): JSX.Element => (
    <BnPageHero
      eyebrow={heroEyebrow}
      title={greet(lang, firstName)}
      subtitle={heroSubtitle}
      actions={
        <>
          <BnButton
            label={lang === 'sw' ? 'Tafuta bidhaa' : 'Browse listings'}
            onPress={() => router.push('/marketplace')}
            variant="primary"
            size="md"
            trailingIcon=">"
          />
          <BnButton
            label={lang === 'sw' ? 'Uliza BossNyumba' : 'Ask BossNyumba'}
            onPress={() => router.push('/chat')}
            variant="secondary"
            size="md"
            leadingIcon="*"
          />
        </>
      }
    />
  )

  if (isInitialLoad) {
    return (
      <Screen>
        {renderHero()}
        <View style={styles.loader}>
          <ActivityIndicator color={tokens.color.gold} />
        </View>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen refreshing={isFetching && !isInitialLoad} onRefresh={onRefresh}>
        {renderHero()}
        <MarketplaceEmptyState message={t('dashboard.load_failed')} tone="error" />
      </Screen>
    )
  }

  const listings = listingsQuery.data ?? []
  const bids = bidsQuery.data ?? []

  return (
    <Screen refreshing={isFetching && !isInitialLoad} onRefresh={onRefresh}>
      {renderHero()}

      <View style={styles.gap}>
        <TrustBalanceStrip user={user} translate={t} />
      </View>

      <View style={styles.gap}>
        <LiveAuctionLobby
          listings={listings}
          translate={t}
          onPressListing={(id) => router.push(`/marketplace/${id}`)}
        />
      </View>

      <View style={styles.gap}>
        <RecommendedParcels
          listings={listings}
          translate={t}
          onPressListing={(id) => router.push(`/marketplace/${id}`)}
        />
      </View>

      <View style={styles.gap}>
        <ActiveBidsSection
          bids={bids}
          translate={t}
          onPressBid={(id) => router.push(`/bids/${id}`)}
        />
      </View>

      <View style={styles.gap}>
        <DealPipelineSection bids={bids} translate={t} />
      </View>

      <View style={styles.gap}>
        <BuyerPerformanceSection bids={bids} translate={t} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { paddingVertical: tokens.space.xxl, alignItems: 'center' },
  gap: { marginBottom: tokens.space.sm }
})
