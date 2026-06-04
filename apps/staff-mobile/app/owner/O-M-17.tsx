import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { BigNumber } from '../../src/components/StubBlocks'
import { PlaceholderList } from '../../src/components/PlaceholderList'
import { RoleGuard } from '../../src/components/RoleGuard'
import { PreviewBanner } from '../../src/components/PreviewBanner'
import { miningApi } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'O-M-17'

const COPY = Object.freeze({
  loading: 'Inapakia kodi za soko…',
  spotTitle: 'Kodi ya soko ya kupangisha',
  spotLabel: 'USD kwa m² (wastani wa siku 90)',
  spotCaption: 'Tofauti na wastani wa wiki: ',
  historyTitle: 'Mwendo wa kodi',
  fxTitle: 'FX iliyorekodiwa kwenye mikataba',
  decisionTitle: 'Uamuzi — pangisha au shikilia',
  recHigh: 'Kodi iko juu — pendekezo: PANGISHA leo',
  recLow: 'Kodi chini ya wastani — pendekezo: SHIKILIA',
  recMid: 'Kodi iko karibu na wastani — angalia tena baada ya saa 6',
  pickSell: 'Pangisha',
  pickHold: 'Shikilia',
  decisionSell: 'Chaguo: PANGISHA kitengo kinachopatikana sasa',
  decisionHold: 'Chaguo: SHIKILIA hadi kodi ipande zaidi',
  juuLabel: 'Juu ya wastani',
  chiniLabel: 'Chini ya wastani'
})

interface LeaseRow {
  readonly id: string
  readonly unitId: string
  readonly grossPriceUsd: string | null
  readonly fxAtSaleTzsPerUsd: string | null
  readonly ts: string
}

interface UnitRow {
  readonly id: string
  readonly areaSqm: string | null
}

interface LeasesResponse {
  readonly success: true
  readonly data: ReadonlyArray<LeaseRow>
}

interface UnitsResponse {
  readonly success: true
  readonly data: ReadonlyArray<UnitRow>
}

interface PriceObs {
  readonly date: string
  readonly rentPerSqmUsd: number
  readonly aboveAvg: boolean
}

interface FxObs {
  readonly id: string
  readonly date: string
  readonly rate: number
}

type Decision = 'sell' | 'hold'

const SALES_KEY = ['owner', 'leases', 'all'] as const
const PARCELS_KEY = ['owner', 'units', 'all'] as const
const HOLD_THRESHOLD_PCT = -0.5

function toNumber(value: string | null): number {
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().slice(5, 10)
}

export default function Screen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <FxRentWindow />
      </ScreenShell>
    </RoleGuard>
  )
}

function FxRentWindow(): JSX.Element {
  const [decision, setDecision] = useState<Decision>('sell')

  const salesQuery = useQuery<ReadonlyArray<LeaseRow>, ApiError>({
    queryKey: SALES_KEY,
    queryFn: async ({ signal }) => {
      const response = await miningApi.get<LeasesResponse>('/leases', { signal })
      return response.data
    }
  })

  const parcelsQuery = useQuery<ReadonlyArray<UnitRow>, ApiError>({
    queryKey: PARCELS_KEY,
    queryFn: async ({ signal }) => {
      const response = await miningApi.get<UnitsResponse>('/units', { signal })
      return response.data
    }
  })

  const areaByUnit = useMemo<ReadonlyMap<string, number>>(() => {
    const map = new Map<string, number>()
    for (const unit of parcelsQuery.data ?? []) {
      map.set(unit.id, toNumber(unit.areaSqm))
    }
    return map
  }, [parcelsQuery.data])

  const priceHistory = useMemo<ReadonlyArray<PriceObs>>(() => {
    const leases = salesQuery.data ?? []
    const rows: Array<{ date: string; rentPerSqmUsd: number; ts: number }> = []
    for (const lease of leases) {
      const usd = toNumber(lease.grossPriceUsd)
      const area = areaByUnit.get(lease.unitId) ?? 0
      if (usd <= 0 || area <= 0) continue
      rows.push({
        date: dayLabel(lease.ts),
        rentPerSqmUsd: usd / area,
        ts: new Date(lease.ts).getTime()
      })
    }
    rows.sort((a, b) => a.ts - b.ts)
    if (rows.length === 0) return []
    const avg = rows.reduce((s, r) => s + r.rentPerSqmUsd, 0) / rows.length
    return rows.map((r) => ({
      date: r.date,
      rentPerSqmUsd: Number(r.rentPerSqmUsd.toFixed(2)),
      aboveAvg: r.rentPerSqmUsd >= avg
    }))
  }, [salesQuery.data, areaByUnit])

  const avgRentPerSqmUsd = useMemo<number>(() => {
    if (priceHistory.length === 0) return 0
    const total = priceHistory.reduce((s, r) => s + r.rentPerSqmUsd, 0)
    return total / priceHistory.length
  }, [priceHistory])

  const latestRentPerSqmUsd = useMemo<number>(() => {
    if (priceHistory.length === 0) return 0
    return priceHistory[priceHistory.length - 1]!.rentPerSqmUsd
  }, [priceHistory])

  const deltaPct = useMemo<number>(() => {
    if (avgRentPerSqmUsd === 0 || latestRentPerSqmUsd === 0) return 0
    return Number((((latestRentPerSqmUsd - avgRentPerSqmUsd) / avgRentPerSqmUsd) * 100).toFixed(2))
  }, [avgRentPerSqmUsd, latestRentPerSqmUsd])

  const recommendation = useMemo<string>(() => {
    if (deltaPct >= 1) return COPY.recHigh
    if (deltaPct <= HOLD_THRESHOLD_PCT) return COPY.recLow
    return COPY.recMid
  }, [deltaPct])

  const fxObservations = useMemo<ReadonlyArray<FxObs>>(() => {
    const leases = salesQuery.data ?? []
    const seen: Array<FxObs> = []
    for (const lease of leases) {
      const rate = toNumber(lease.fxAtSaleTzsPerUsd)
      if (rate <= 0) continue
      seen.push({
        id: lease.id,
        date: dayLabel(lease.ts),
        rate: Number(rate.toFixed(2))
      })
    }
    return seen.slice(0, 8)
  }, [salesQuery.data])

  if (salesQuery.isLoading || parcelsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.goldDark} />
        <Text style={styles.loadingLabel}>{COPY.loading}</Text>
      </View>
    )
  }

  if (salesQuery.isError || parcelsQuery.isError) {
    const err = salesQuery.error ?? parcelsQuery.error
    return <PreviewBanner kind={isOfflineError(err) ? 'offline' : 'env-missing'} />
  }

  if (priceHistory.length === 0) {
    return <PreviewBanner kind="no-data" />
  }

  return (
    <View>
      <Section title={COPY.spotTitle}>
        <BigNumber
          value={`USD ${latestRentPerSqmUsd.toFixed(2)}`}
          label={COPY.spotLabel}
          caption={`${COPY.spotCaption}${deltaPct >= 0 ? '+' : ''}${deltaPct}%`}
        />
      </Section>
      <Section title={COPY.historyTitle}>
        <PlaceholderList
          items={priceHistory.map((h) => ({
            id: `${h.date}-${h.rentPerSqmUsd}`,
            primary: `${h.date} · USD ${h.rentPerSqmUsd.toFixed(2)} / m²`,
            secondary: h.aboveAvg ? COPY.juuLabel : COPY.chiniLabel
          }))}
        />
      </Section>
      {fxObservations.length > 0 ? (
        <Section title={COPY.fxTitle}>
          <PlaceholderList
            items={fxObservations.map((q) => ({
              id: q.id,
              primary: `${q.date} · TZS/USD`,
              secondary: q.rate.toFixed(2)
            }))}
          />
        </Section>
      ) : null}
      <Section title={COPY.decisionTitle}>
        <Text style={styles.recText}>{recommendation}</Text>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chagua kupangisha"
            onPress={() => setDecision('sell')}
            style={[styles.action, decision === 'sell' && styles.sell]}
          >
            <Text style={[styles.actionLabel, decision === 'sell' && styles.actionLabelActive]}>
              {COPY.pickSell}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chagua kuhifadhi"
            onPress={() => setDecision('hold')}
            style={[styles.action, decision === 'hold' && styles.hold]}
          >
            <Text style={[styles.actionLabel, decision === 'hold' && styles.actionLabelActive]}>
              {COPY.pickHold}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.footer}>
          {decision === 'sell' ? COPY.decisionSell : COPY.decisionHold}
        </Text>
      </Section>
    </View>
  )
}

function isOfflineError(error: ApiError | null | undefined): boolean {
  return error != null && error.status === 0
}

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  loadingLabel: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    marginTop: spacing.sm
  },
  recText: {
    color: colors.text,
    fontSize: fontSize.lead,
    fontWeight: '600',
    marginBottom: spacing.md
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  action: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center'
  },
  sell: {
    backgroundColor: colors.gold,
    borderColor: colors.goldDark
  },
  hold: {
    backgroundColor: colors.earth700,
    borderColor: colors.earth900
  },
  actionLabel: {
    color: colors.textMuted,
    fontSize: fontSize.lead,
    fontWeight: '700'
  },
  actionLabelActive: {
    color: colors.earth900
  },
  footer: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    marginTop: spacing.md
  }
})
