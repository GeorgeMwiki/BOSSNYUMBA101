import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { RoleGuard } from '../../src/components/RoleGuard'
import { PreviewBanner } from '../../src/components/PreviewBanner'
import { managerApi } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'O-M-12'

const COPY = Object.freeze({
  loading: 'Inapakia data ya watu...',
  summary: (total: number, present: number): string =>
    `Jumla ya watu: ${total} - Waliopo leo: ${present}`,
  permanent: 'Wa kudumu',
  casual: 'Wa muda',
  contractors: 'Wakandarasi',
  sortBy: 'Panga kwa',
  properties: 'Mali',
  presentToday: 'Waliopo leo',
  permanentLine: 'Wa kudumu',
  casualLine: 'Wa muda',
  contractorsLine: 'Wakandarasi'
})

const SORT_LABEL = Object.freeze({
  name: 'Jina',
  total: 'Jumla',
  present: 'Waliopo leo'
}) as Readonly<Record<SortKey, string>>

type SortKey = 'name' | 'total' | 'present'

const SORT_KEYS: ReadonlyArray<SortKey> = ['name', 'total', 'present']

interface PropertyStaff {
  readonly id: string
  readonly name: string
  readonly permanent: number
  readonly casual: number
  readonly contractors: number
  readonly presentToday: number
}

interface StaffCountResponse {
  readonly success?: boolean
  readonly data?: ReadonlyArray<PropertyStaff>
}

export default function Screen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <PeopleByProperty />
      </ScreenShell>
    </RoleGuard>
  )
}

function totalOf(property: PropertyStaff): number {
  return property.permanent + property.casual + property.contractors
}

function useStaffCount(): UseQueryResult<ReadonlyArray<PropertyStaff>, Error> {
  return useQuery<ReadonlyArray<PropertyStaff>, Error>({
    queryKey: ['estate', 'attendance', 'staff-count', 'property'],
    queryFn: async ({ signal }) => {
      const response = await managerApi.get<StaffCountResponse>(
        '/attendance/staff-count',
        { signal, query: { groupBy: 'property' } }
      )
      const rows = Array.isArray(response?.data) ? response.data : []
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        permanent: Number(row.permanent ?? 0),
        casual: Number(row.casual ?? 0),
        contractors: Number(row.contractors ?? 0),
        presentToday: Number(row.presentToday ?? 0)
      }))
    },
    staleTime: 60_000
  })
}

function PeopleByProperty(): JSX.Element {
  const [sortBy, setSortBy] = useState<SortKey>('total')
  const [expanded, setExpanded] = useState<string | null>(null)
  const query = useStaffCount()

  const sorted = useMemo<ReadonlyArray<PropertyStaff>>(() => {
    const rows = query.data ?? []
    const copy = [...rows]
    if (sortBy === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'present') return copy.sort((a, b) => b.presentToday - a.presentToday)
    return copy.sort((a, b) => totalOf(b) - totalOf(a))
  }, [query.data, sortBy])

  const totals = useMemo(() => {
    const rows = query.data ?? []
    return rows.reduce(
      (acc, m) => ({
        permanent: acc.permanent + m.permanent,
        casual: acc.casual + m.casual,
        contractors: acc.contractors + m.contractors,
        present: acc.present + m.presentToday
      }),
      { permanent: 0, casual: 0, contractors: 0, present: 0 }
    )
  }, [query.data])

  const toggle = useCallback((id: string): void => {
    setExpanded((current) => (current === id ? null : id))
  }, [])

  if (query.isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.gold} />
        <Text style={styles.loadingText}>{COPY.loading}</Text>
      </View>
    )
  }

  if (query.isError) {
    const status = query.error instanceof ApiError ? query.error.status : -1
    const kind = status === 0 ? 'offline' : 'env-missing'
    return (
      <View>
        <PreviewBanner kind={kind} />
      </View>
    )
  }

  if (sorted.length === 0) {
    return (
      <View>
        <PreviewBanner kind="no-data" />
      </View>
    )
  }

  const grandTotal = totals.permanent + totals.casual + totals.contractors

  return (
    <View>
      <Section title={COPY.summary(grandTotal, totals.present)}>
        <View style={styles.summaryRow}>
          <SummaryPill label={COPY.permanent} value={totals.permanent} />
          <SummaryPill label={COPY.casual} value={totals.casual} />
          <SummaryPill label={COPY.contractors} value={totals.contractors} />
        </View>
      </Section>
      <Section title={COPY.sortBy}>
        <View style={styles.sortRow}>
          {SORT_KEYS.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`Panga kwa ${SORT_LABEL[key]}`}
              onPress={() => setSortBy(key)}
              style={[styles.sortChip, sortBy === key && styles.sortChipActive]}
            >
              <Text style={[styles.sortLabel, sortBy === key && styles.sortLabelActive]}>
                {SORT_LABEL[key]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>
      <Section title={COPY.properties}>
        {sorted.map((property) => {
          const isOpen = expanded === property.id
          const total = totalOf(property)
          const presentPct = total === 0 ? 0 : Math.round((property.presentToday / total) * 100)
          return (
            <Pressable
              key={property.id}
              accessibilityRole="button"
              accessibilityLabel={`Onyesha ${property.name}`}
              onPress={() => toggle(property.id)}
              style={[styles.propertyRow, isOpen && styles.propertyRowOpen]}
            >
              <View style={styles.propertyHeader}>
                <Text style={styles.propertyName}>{property.name}</Text>
                <Text style={styles.propertyTotal}>{total}</Text>
              </View>
              <Text style={styles.propertyMeta}>
                {COPY.presentToday}: {property.presentToday} ({presentPct}%)
              </Text>
              {isOpen ? (
                <View style={styles.propertyDetail}>
                  <Text style={styles.detailLine}>{COPY.permanentLine}: {property.permanent}</Text>
                  <Text style={styles.detailLine}>{COPY.casualLine}: {property.casual}</Text>
                  <Text style={styles.detailLine}>{COPY.contractorsLine}: {property.contractors}</Text>
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </Section>
    </View>
  )
}

interface SummaryPillProps {
  readonly label: string
  readonly value: number
}

function SummaryPill({ label, value }: SummaryPillProps): JSX.Element {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  loadingWrap: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  loadingText: { color: colors.textMuted, fontSize: fontSize.body },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.earth700,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  pillValue: { color: colors.goldLight, fontSize: fontSize.h2, fontWeight: '800' },
  pillLabel: { color: colors.earth100, fontSize: fontSize.caption, marginTop: spacing.xs },
  sortRow: { flexDirection: 'row', gap: spacing.sm },
  sortChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1
  },
  sortChipActive: { backgroundColor: colors.gold, borderColor: colors.goldDark },
  sortLabel: { color: colors.textMuted, fontSize: fontSize.caption, fontWeight: '600' },
  sortLabelActive: { color: colors.earth900 },
  propertyRow: {
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    marginBottom: spacing.sm
  },
  propertyRowOpen: { borderColor: colors.gold, borderWidth: 1 },
  propertyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  propertyName: { color: colors.text, fontSize: fontSize.lead, fontWeight: '700' },
  propertyTotal: { color: colors.goldDark, fontSize: fontSize.h3, fontWeight: '800' },
  propertyMeta: { color: colors.textMuted, fontSize: fontSize.body, marginTop: spacing.xs },
  propertyDetail: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopColor: colors.border, borderTopWidth: 1 },
  detailLine: { color: colors.text, fontSize: fontSize.body, marginTop: spacing.xs }
})
