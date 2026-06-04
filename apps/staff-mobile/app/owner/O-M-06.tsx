import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQueries } from '@tanstack/react-query'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { RoleGuard } from '../../src/components/RoleGuard'
import { PreviewBanner } from '../../src/components/PreviewBanner'
import { managerApi } from '../../src/api/client'
import { ApiError, isNetworkError } from '../../src/api/errors'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'O-M-06'

const COPY = Object.freeze({
  loading: 'Inakusanya muhtasari wa siku…',
  errorInline: 'Imeshindwa kupakua muhtasari wa siku.',
  emptyHint: 'Hakuna shifti za siku ya leo bado.',
  sectionSummary: 'Muhtasari wa siku',
  sectionSummaryHint: 'Vipande vya KPI kutoka kwa daily-brief + ukaaji',
  sectionSites: 'Majengo · bonyeza moja kuona zaidi',
  sectionFocus: 'Kina cha jengo',
  sectionFocusHint: 'Kodi, gharama na shifti za siku 30',
  sectionBlockers: 'Vizuizi vya leo',
  kpiAttendance: 'Shifti za leo',
  kpiAttendanceUnit: 'mlolongo',
  kpiRent: 'Kodi (30d)',
  kpiRentUnitPrefix: 'jumla',
  kpiCost: 'Gharama (30d)',
  kpiCostUnit: 'jumla',
  kpiBlockers: 'Vizuizi vya wazi',
  kpiBlockersUnit: 'incidents + grievances',
  blockerIncidentsLabel: 'Incidents zilizo wazi',
  blockerGrievancesLabel: 'Grievances zilizo wazi',
  blockerCriticalLabel: 'Critical / High'
})

interface DailyBrief {
  readonly date: string
  readonly shiftsToday: number
  readonly openIncidents: number
  readonly openGrievances: number
  readonly criticalIncidents: number
}

interface PropertyRow {
  readonly siteId: string
  readonly rent: number
  readonly cost: number
  readonly shifts: number
}

interface OccupancyData {
  readonly window: '30d'
  readonly perSite: ReadonlyArray<PropertyRow>
}

interface ApiEnvelope<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: { code?: string; message?: string }
}

export default function Screen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <DailyReportView />
      </ScreenShell>
    </RoleGuard>
  )
}

function DailyReportView(): JSX.Element {
  const [briefQuery, occupancyQuery] = useQueries({
    queries: [
      {
        queryKey: ['estate', 'cockpit', 'daily-brief'],
        queryFn: async (ctx: { signal?: AbortSignal }) => {
          const envelope = await managerApi.get<ApiEnvelope<DailyBrief>>(
            '/cockpit/daily-brief',
            ctx.signal ? { signal: ctx.signal } : {}
          )
          if (!envelope.success || !envelope.data) {
            throw new Error(envelope.error?.message ?? COPY.errorInline)
          }
          return envelope.data
        }
      },
      {
        queryKey: ['estate', 'cockpit', 'occupancy-vs-target'],
        queryFn: async (ctx: { signal?: AbortSignal }) => {
          const envelope = await managerApi.get<ApiEnvelope<OccupancyData>>(
            '/cockpit/occupancy-vs-target',
            ctx.signal ? { signal: ctx.signal } : {}
          )
          if (!envelope.success || !envelope.data) {
            throw new Error(envelope.error?.message ?? COPY.errorInline)
          }
          return envelope.data
        }
      }
    ]
  })

  const [focusPropertyId, setFocusPropertyId] = useState<string>('')

  const properties = useMemo<ReadonlyArray<PropertyRow>>(
    () => occupancyQuery.data?.perSite ?? [],
    [occupancyQuery.data]
  )

  const totals = useMemo(() => {
    const rent = properties.reduce((sum, row) => sum + Number(row.rent || 0), 0)
    const cost = properties.reduce((sum, row) => sum + Number(row.cost || 0), 0)
    return { rent, cost }
  }, [properties])

  const focusedProperty = useMemo<PropertyRow | undefined>(() => {
    if (properties.length === 0) return undefined
    return properties.find((p) => p.siteId === focusPropertyId) ?? properties[0]
  }, [focusPropertyId, properties])

  const isPending = briefQuery.isPending || occupancyQuery.isPending
  const isError = briefQuery.isError || occupancyQuery.isError
  const composedError = briefQuery.error ?? occupancyQuery.error

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
        <Text style={styles.loadingLabel}>{COPY.loading}</Text>
      </View>
    )
  }

  if (isError) {
    return (
      <View>
        {isBackendUnavailable(composedError) ? (
          <PreviewBanner kind="env-missing" />
        ) : (
          <Text style={styles.errorInline}>{COPY.errorInline}</Text>
        )}
      </View>
    )
  }

  const brief = briefQuery.data
  if (!brief || (properties.length === 0 && brief.shiftsToday === 0)) {
    return (
      <View>
        <PreviewBanner kind="no-data" />
        <Text style={styles.emptyHint}>{COPY.emptyHint}</Text>
      </View>
    )
  }

  const openBlockers = brief.openIncidents + brief.openGrievances

  return (
    <View>
      <Section title={COPY.sectionSummary} hint={`${COPY.sectionSummaryHint} · ${brief.date}`}>
        <View style={styles.kpiGrid}>
          <KpiTile
            label={COPY.kpiAttendance}
            value={String(brief.shiftsToday)}
            unit={COPY.kpiAttendanceUnit}
          />
          <KpiTile
            label={COPY.kpiRent}
            value={formatNumber(totals.rent)}
            unit={`${COPY.kpiRentUnitPrefix} ${formatNumber(totals.rent)}`}
          />
          <KpiTile
            label={COPY.kpiCost}
            value={formatNumber(totals.cost)}
            unit={COPY.kpiCostUnit}
          />
          <KpiTile
            label={COPY.kpiBlockers}
            value={String(openBlockers)}
            unit={COPY.kpiBlockersUnit}
            danger={brief.criticalIncidents > 0}
          />
        </View>
      </Section>
      {properties.length > 0 ? (
        <Section title={COPY.sectionSites}>
          {properties.map((property) => (
            <Pressable
              key={property.siteId}
              accessibilityRole="button"
              accessibilityLabel={`Jengo ${property.siteId}`}
              onPress={() => setFocusPropertyId(property.siteId)}
              style={({ pressed }) => [
                styles.siteRow,
                (focusedProperty?.siteId ?? '') === property.siteId && styles.siteRowActive,
                pressed && styles.siteRowPressed
              ]}
            >
              <Text style={styles.siteName}>{property.siteId}</Text>
              <View style={styles.siteMeta}>
                <Text style={styles.siteMetaItem}>Shifti {property.shifts}</Text>
                <Text style={styles.siteMetaItem}>Kodi {formatNumber(property.rent)}</Text>
                <Text style={styles.siteMetaItem}>Gharama {formatNumber(property.cost)}</Text>
              </View>
            </Pressable>
          ))}
        </Section>
      ) : null}
      {focusedProperty ? (
        <Section title={COPY.sectionFocus} hint={COPY.sectionFocusHint}>
          <View style={styles.focus}>
            <FocusStat label="Shifti" value={String(focusedProperty.shifts)} suffix="siku 30" />
            <FocusStat
              label="Kodi"
              value={formatNumber(focusedProperty.rent)}
              suffix={`jumla ${formatNumber(focusedProperty.rent)}`}
            />
            <FocusStat
              label="Gharama"
              value={formatNumber(focusedProperty.cost)}
              suffix="jumla siku 30"
            />
          </View>
        </Section>
      ) : null}
      <Section title={COPY.sectionBlockers}>
        <BlockerRow
          label={COPY.blockerIncidentsLabel}
          value={String(brief.openIncidents)}
          accent="warn"
        />
        <BlockerRow
          label={COPY.blockerGrievancesLabel}
          value={String(brief.openGrievances)}
          accent="warn"
        />
        <BlockerRow
          label={COPY.blockerCriticalLabel}
          value={String(brief.criticalIncidents)}
          accent="danger"
        />
      </Section>
    </View>
  )
}

function KpiTile({
  label,
  value,
  unit,
  danger
}: {
  label: string
  value: string
  unit: string
  danger?: boolean
}): JSX.Element {
  return (
    <View style={[styles.kpiTile, danger ? styles.kpiTileDanger : null]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiUnit}>{unit}</Text>
    </View>
  )
}

function FocusStat({
  label,
  value,
  suffix
}: {
  label: string
  value: string
  suffix: string
}): JSX.Element {
  return (
    <View style={styles.focusStat}>
      <Text style={styles.focusLabel}>{label}</Text>
      <Text style={styles.focusValue}>{value}</Text>
      <Text style={styles.focusSuffix}>{suffix}</Text>
    </View>
  )
}

function BlockerRow({
  label,
  value,
  accent
}: {
  label: string
  value: string
  accent: 'warn' | 'danger'
}): JSX.Element {
  const borderColor = accent === 'danger' ? colors.danger : colors.warn
  return (
    <View style={[styles.blockerCard, { borderLeftColor: borderColor }]}>
      <Text style={styles.blockerSite}>{label}</Text>
      <Text style={styles.blockerIssue}>{value}</Text>
    </View>
  )
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`
  }
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

function isBackendUnavailable(error: unknown): boolean {
  if (isNetworkError(error)) return true
  if (error instanceof ApiError) return error.status >= 500 || error.status === 503
  return false
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    paddingVertical: spacing.xl
  },
  loadingLabel: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: fontSize.body
  },
  errorInline: {
    color: colors.danger,
    fontSize: fontSize.body,
    fontWeight: '600',
    marginVertical: spacing.md
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: fontSize.body
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  kpiTile: {
    width: '48%',
    backgroundColor: colors.earth700,
    padding: spacing.md,
    borderRadius: radius.md
  },
  kpiTileDanger: {
    backgroundColor: colors.danger
  },
  kpiLabel: {
    color: colors.earth100,
    fontSize: fontSize.caption,
    fontWeight: '600'
  },
  kpiValue: {
    color: colors.goldLight,
    fontSize: fontSize.h1,
    fontWeight: '800',
    marginTop: spacing.xs
  },
  kpiUnit: {
    color: colors.textInverse,
    fontSize: fontSize.body,
    marginTop: spacing.xs
  },
  siteRow: {
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border
  },
  siteRowActive: {
    borderColor: colors.gold,
    backgroundColor: colors.earth100
  },
  siteRowPressed: {
    opacity: 0.85
  },
  siteName: {
    color: colors.text,
    fontSize: fontSize.lead,
    fontWeight: '700'
  },
  siteMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm
  },
  siteMetaItem: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    fontWeight: '600'
  },
  focus: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  focusStat: {
    flex: 1,
    backgroundColor: colors.gold,
    padding: spacing.md,
    borderRadius: radius.md
  },
  focusLabel: {
    color: colors.earth900,
    fontSize: fontSize.caption,
    fontWeight: '700'
  },
  focusValue: {
    color: colors.earth900,
    fontSize: fontSize.h2,
    fontWeight: '800',
    marginTop: spacing.xs
  },
  focusSuffix: {
    color: colors.earth700,
    fontSize: fontSize.caption,
    marginTop: spacing.xs
  },
  blockerCard: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4
  },
  blockerSite: {
    color: colors.earth900,
    fontSize: fontSize.body,
    fontWeight: '700'
  },
  blockerIssue: {
    color: colors.text,
    fontSize: fontSize.lead,
    marginTop: spacing.xs,
    fontWeight: '700'
  }
})
