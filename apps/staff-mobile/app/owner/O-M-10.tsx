import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { RoleGuard } from '../../src/components/RoleGuard'
import { PreviewBanner } from '../../src/components/PreviewBanner'
import { miningApi } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'O-M-10'

const COPY = Object.freeze({
  loading: 'Inapakia upangishaji…',
  filterTitle: 'Chuja kwa hatua',
  totalsPrefix: 'Jumla · ',
  totalsParcels: ' vitengo',
  marketPriceLabel: 'Kodi ya soko ya wastani: ',
  variancePrefix: 'Tofauti dhidi ya soko: ',
  noBuyer: 'Bila mpangaji',
  stageAll: 'Zote',
  stageSampling: 'Imetangazwa',
  stageOffer: 'Ombi limepokelewa',
  stageShipped: 'Imeingiwa',
  statusPending: 'Inasubiri malipo',
  statusPartial: 'Sehemu',
  statusPaid: 'Imelipwa',
  statusCancelled: 'Imefutwa'
})

type UnitStatus = 'vacant' | 'reserved' | 'moving_in' | 'occupied' | 'withdrawn'
type PaymentStatus = 'pending' | 'partial' | 'paid' | 'cancelled'

interface UnitRow {
  readonly id: string
  readonly propertyId: string
  readonly areaSqm: string | null
  readonly grade: Record<string, unknown>
  readonly status: UnitStatus
  readonly attributes: Record<string, unknown>
  readonly createdAt: string
}

interface LeaseRow {
  readonly id: string
  readonly unitId: string
  readonly tenantId: string | null
  readonly route: string
  readonly grossPriceUsd: string | null
  readonly grossPriceTzs: string | null
  readonly fxAtSaleTzsPerUsd: string | null
  readonly netTzs: string | null
  readonly paymentStatus: PaymentStatus
  readonly ts: string
}

interface UnitsResponse {
  readonly success: true
  readonly data: ReadonlyArray<UnitRow>
}

interface LeasesResponse {
  readonly success: true
  readonly data: ReadonlyArray<LeaseRow>
}

type StageFilter = 'all' | 'sampling' | 'offer' | 'shipped' | 'sold'

interface JoinedRow {
  readonly id: string
  readonly stage: StageFilter
  readonly unitLabel: string
  readonly areaSqm: number
  readonly netTzs: number
  readonly grossUsd: number
  readonly fxRate: number
  readonly paymentStatus: PaymentStatus | null
  readonly tenantId: string | null
  readonly propertyId: string
  readonly createdAt: string
}

const STAGE_ORDER: ReadonlyArray<StageFilter> = ['all', 'sampling', 'offer', 'shipped', 'sold']

const STAGE_LABEL: Readonly<Record<StageFilter, string>> = {
  all: COPY.stageAll,
  sampling: COPY.stageSampling,
  offer: COPY.stageOffer,
  shipped: COPY.stageShipped,
  sold: COPY.statusPaid
}

const PAYMENT_LABEL: Readonly<Record<PaymentStatus, string>> = {
  pending: COPY.statusPending,
  partial: COPY.statusPartial,
  paid: COPY.statusPaid,
  cancelled: COPY.statusCancelled
}

const PARCELS_KEY = ['owner', 'units'] as const
const SALES_KEY = ['owner', 'leases'] as const

function toNumber(value: string | null | undefined): number {
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function pickUnitLabel(grade: Record<string, unknown>, attributes: Record<string, unknown>): string {
  const unitFromAttrs = typeof attributes.unit === 'string' ? attributes.unit : null
  if (unitFromAttrs) return unitFromAttrs
  const keys = Object.keys(grade)
  if (keys.length === 0) return '-'
  const firstKey = keys[0]!
  return firstKey
}

function stageFromUnitStatus(status: UnitStatus, hasLease: boolean): StageFilter {
  if (status === 'vacant') return hasLease ? 'offer' : 'sampling'
  if (status === 'reserved' || status === 'moving_in') return 'shipped'
  if (status === 'occupied') return 'sold'
  return 'sampling'
}

export default function Screen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <SalesPipeline />
      </ScreenShell>
    </RoleGuard>
  )
}

function SalesPipeline(): JSX.Element {
  const [filter, setFilter] = useState<StageFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const parcelsQuery = useQuery<ReadonlyArray<UnitRow>, ApiError>({
    queryKey: PARCELS_KEY,
    queryFn: async ({ signal }) => {
      const response = await miningApi.get<UnitsResponse>('/units', { signal })
      return response.data
    }
  })

  const salesQuery = useQuery<ReadonlyArray<LeaseRow>, ApiError>({
    queryKey: SALES_KEY,
    queryFn: async ({ signal }) => {
      const response = await miningApi.get<LeasesResponse>('/leases', { signal })
      return response.data
    }
  })

  const select = useCallback((id: string): void => {
    setSelectedId((current) => (current === id ? null : id))
  }, [])

  const joinedRows = useMemo<ReadonlyArray<JoinedRow>>(() => {
    if (!parcelsQuery.data || !salesQuery.data) return []
    const leasesByUnit = new Map<string, LeaseRow>()
    for (const lease of salesQuery.data) {
      leasesByUnit.set(lease.unitId, lease)
    }
    return parcelsQuery.data.map((unit) => {
      const lease = leasesByUnit.get(unit.id) ?? null
      return {
        id: unit.id,
        stage: stageFromUnitStatus(unit.status, lease !== null),
        unitLabel: pickUnitLabel(unit.grade, unit.attributes),
        areaSqm: toNumber(unit.areaSqm),
        netTzs: toNumber(lease?.netTzs),
        grossUsd: toNumber(lease?.grossPriceUsd),
        fxRate: toNumber(lease?.fxAtSaleTzsPerUsd),
        paymentStatus: lease?.paymentStatus ?? null,
        tenantId: lease?.tenantId ?? null,
        propertyId: unit.propertyId,
        createdAt: unit.createdAt
      }
    })
  }, [parcelsQuery.data, salesQuery.data])

  const referenceRentPerSqmUsd = useMemo<number>(() => {
    const rows = joinedRows.filter((r) => r.grossUsd > 0 && r.areaSqm > 0)
    if (rows.length === 0) return 0
    const total = rows.reduce((sum, r) => sum + r.grossUsd / r.areaSqm, 0)
    return total / rows.length
  }, [joinedRows])

  const visible = useMemo<ReadonlyArray<JoinedRow>>(() => {
    if (filter === 'all') return joinedRows
    return joinedRows.filter((row) => row.stage === filter)
  }, [filter, joinedRows])

  const totals = useMemo(() => {
    return visible.reduce(
      (acc, row) => ({ netTzs: acc.netTzs + row.netTzs, count: acc.count + 1 }),
      { netTzs: 0, count: 0 }
    )
  }, [visible])

  if (parcelsQuery.isLoading || salesQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.goldDark} />
        <Text style={styles.loadingLabel}>{COPY.loading}</Text>
      </View>
    )
  }

  if (parcelsQuery.isError || salesQuery.isError) {
    const err = parcelsQuery.error ?? salesQuery.error
    return <PreviewBanner kind={isOfflineError(err) ? 'offline' : 'env-missing'} />
  }

  if (joinedRows.length === 0) {
    return <PreviewBanner kind="no-data" />
  }

  return (
    <View>
      <Section title={COPY.filterTitle}>
        <View style={styles.chips}>
          {STAGE_ORDER.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`Chuja ${STAGE_LABEL[s]}`}
              onPress={() => setFilter(s)}
              style={[styles.chip, filter === s && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, filter === s && styles.chipLabelActive]}>
                {STAGE_LABEL[s]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>
      <Section title={`${COPY.totalsPrefix}${totals.count}${COPY.totalsParcels} · TZS ${Math.round(totals.netTzs).toLocaleString('en-US')}`}>
        {visible.map((row) => {
          const isOpen = selectedId === row.id
          const marketUsd = referenceRentPerSqmUsd > 0 ? Math.round(referenceRentPerSqmUsd * row.areaSqm) : 0
          const variancePct =
            marketUsd === 0 || row.grossUsd === 0
              ? null
              : Math.round(((row.grossUsd - marketUsd) / marketUsd) * 100)
          return (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={`Chagua ${row.id}`}
              onPress={() => select(row.id)}
              style={[styles.row, isOpen && styles.rowOpen]}
            >
              <Text style={styles.rowPrimary}>
                {row.id.slice(0, 8)} - {row.areaSqm} m² {row.unitLabel}
              </Text>
              <Text style={styles.rowSecondary}>
                {STAGE_LABEL[row.stage]}
                {row.paymentStatus ? ` - ${PAYMENT_LABEL[row.paymentStatus]}` : ''}
                {' - '}
                {row.tenantId ?? COPY.noBuyer}
              </Text>
              {row.netTzs > 0 ? (
                <Text style={styles.rowMoney}>
                  Net TZS {Math.round(row.netTzs).toLocaleString('en-US')}
                </Text>
              ) : null}
              {isOpen ? (
                <View style={styles.detail}>
                  {marketUsd > 0 ? (
                    <Text style={styles.detailLine}>
                      {COPY.marketPriceLabel}USD {marketUsd.toLocaleString('en-US')}
                    </Text>
                  ) : null}
                  {variancePct !== null ? (
                    <Text
                      style={[
                        styles.detailLine,
                        variancePct >= 0 ? styles.positive : styles.negative
                      ]}
                    >
                      {COPY.variancePrefix}
                      {variancePct >= 0 ? '+' : ''}
                      {variancePct}%
                    </Text>
                  ) : null}
                  {row.fxRate > 0 ? (
                    <Text style={styles.detailLine}>FX: {row.fxRate.toFixed(2)}</Text>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          )
        })}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.goldDark },
  chipLabel: { color: colors.textMuted, fontSize: fontSize.caption, fontWeight: '600' },
  chipLabelActive: { color: colors.earth900 },
  row: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm
  },
  rowOpen: { borderColor: colors.gold, borderWidth: 1 },
  rowPrimary: { color: colors.text, fontSize: fontSize.lead, fontWeight: '600' },
  rowSecondary: { color: colors.textMuted, fontSize: fontSize.body, marginTop: spacing.xs },
  rowMoney: { color: colors.goldDark, fontSize: fontSize.body, fontWeight: '700', marginTop: spacing.xs },
  detail: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1
  },
  detailLine: { color: colors.text, fontSize: fontSize.body, marginTop: spacing.xs },
  positive: { color: colors.success, fontWeight: '700' },
  negative: { color: colors.danger, fontWeight: '700' }
})
