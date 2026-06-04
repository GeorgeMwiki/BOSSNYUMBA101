import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { RoleGuard } from '../../src/components/RoleGuard'
import { PreviewBanner } from '../../src/components/PreviewBanner'
import { miningApi } from '../../src/api/client'
import { ApiError, isNetworkError } from '../../src/api/errors'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'O-M-04'

const COPY = Object.freeze({
  loading: 'Inapakia ramani ya portfolio…',
  errorInline: 'Ombi la portfolio limeshindwa kuthibitishwa.',
  emptyHint: 'Hakuna mali au mikataba iliyosajiliwa kwenye akaunti yako.',
  sectionMap: 'Ramani ya portifolio',
  sectionMapHint: 'Polygons + rangi za hali · bonyeza kuchagua',
  sectionFilter: 'Chuja kwa hali',
  sectionList: 'Mali',
  unknown: 'Haijulikani'
})

type FeatureLayer = 'property' | 'lease'
type FilterKey = 'all' | 'active' | 'occupied' | 'pending' | 'expired'
type PropertyStatus = Exclude<FilterKey, 'all'>

interface PortfolioFeature {
  readonly type: 'Feature'
  readonly geometry: Readonly<Record<string, unknown>>
  readonly properties: Readonly<Record<string, unknown>>
}

interface PortfolioMapResponse {
  readonly type: 'FeatureCollection'
  readonly features: ReadonlyArray<PortfolioFeature>
  readonly layers: {
    readonly properties: number
    readonly leases: number
    readonly settlements: number
    readonly protectedAreas: number
  }
}

interface ApiEnvelope<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: { code?: string; message?: string }
}

interface NormalizedProperty {
  readonly id: string
  readonly label: string
  readonly region: string
  readonly unitLabel: string
  readonly layer: FeatureLayer
  readonly status: PropertyStatus
  readonly rawStatus: string
}

const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Zote' },
  { key: 'active', label: 'Hai' },
  { key: 'occupied', label: 'Imepangishwa' },
  { key: 'pending', label: 'Subiri' },
  { key: 'expired', label: 'Imekwisha' }
]

export default function Screen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <PortfolioMapView />
      </ScreenShell>
    </RoleGuard>
  )
}

function PortfolioMapView(): JSX.Element {
  const query = useQuery<PortfolioMapResponse, Error>({
    queryKey: ['owner', 'portfolio-map'],
    queryFn: async ({ signal }) => {
      const envelope = await miningApi.get<ApiEnvelope<PortfolioMapResponse>>(
        '/portfolio-map',
        { signal }
      )
      if (!envelope.success || !envelope.data) {
        throw new Error(envelope.error?.message ?? COPY.errorInline)
      }
      return envelope.data
    }
  })

  const properties = useMemo<ReadonlyArray<NormalizedProperty>>(() => {
    if (!query.data) return []
    return query.data.features.map((feature, index) => normalize(feature, index))
  }, [query.data])

  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visible = useMemo<ReadonlyArray<NormalizedProperty>>(
    () =>
      filter === 'all'
        ? properties
        : properties.filter((m) => m.status === filter),
    [filter, properties]
  )

  const totals = useMemo<Record<PropertyStatus, number>>(() => {
    const counts: Record<PropertyStatus, number> = {
      active: 0,
      occupied: 0,
      pending: 0,
      expired: 0
    }
    properties.forEach((m) => {
      counts[m.status] += 1
    })
    return counts
  }, [properties])

  if (query.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
        <Text style={styles.loadingLabel}>{COPY.loading}</Text>
      </View>
    )
  }

  if (query.isError) {
    return (
      <View>
        {isBackendUnavailable(query.error) ? (
          <PreviewBanner kind="env-missing" />
        ) : (
          <Text style={styles.errorInline}>{COPY.errorInline}</Text>
        )}
      </View>
    )
  }

  if (properties.length === 0) {
    return (
      <View>
        <PreviewBanner kind="no-data" />
        <Text style={styles.emptyHint}>{COPY.emptyHint}</Text>
      </View>
    )
  }

  return (
    <View>
      <Section title={COPY.sectionMap} hint={COPY.sectionMapHint}>
        <View style={styles.mapBox}>
          <View style={styles.mapGrid}>
            {properties.map((prop) => (
              <Pressable
                key={prop.id}
                accessibilityRole="button"
                accessibilityLabel={`${prop.label} ${prop.region}`}
                onPress={() => setSelectedId(prop.id)}
                style={({ pressed }) => [
                  styles.polygon,
                  { backgroundColor: statusColor(prop.status) },
                  pressed && styles.polygonPressed,
                  selectedId === prop.id && styles.polygonSelected
                ]}
              >
                <Text style={styles.polygonLabel}>{prop.label}</Text>
                <Text style={styles.polygonRegion}>{prop.region}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.legend}>
            <LegendDot status="active" label={`Hai (${totals.active})`} />
            <LegendDot status="occupied" label={`Imepangishwa (${totals.occupied})`} />
            <LegendDot status="pending" label={`Subiri (${totals.pending})`} />
            <LegendDot status="expired" label={`Kwisha (${totals.expired})`} />
          </View>
        </View>
      </Section>
      <Section title={COPY.sectionFilter}>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityLabel={f.label}
              onPress={() => setFilter(f.key)}
              style={({ pressed }) => [
                styles.chip,
                filter === f.key && styles.chipActive,
                pressed && styles.chipPressed
              ]}
            >
              <Text style={[styles.chipLabel, filter === f.key && styles.chipLabelActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>
      <Section title={`${COPY.sectionList} (${visible.length})`}>
        {visible.map((prop) => (
          <Pressable
            key={prop.id}
            accessibilityRole="button"
            accessibilityLabel={prop.label}
            onPress={() => setSelectedId(prop.id)}
            style={({ pressed }) => [
              styles.row,
              selectedId === prop.id && styles.rowSelected,
              pressed && styles.rowPressed
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor(prop.status) }]} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>
                {prop.label} · {statusLabel(prop.status)}
              </Text>
              <Text style={styles.rowMeta}>
                {prop.region} · {prop.unitLabel} · {prop.layer === 'property' ? 'mali' : 'mkataba'}
              </Text>
            </View>
          </Pressable>
        ))}
      </Section>
    </View>
  )
}

function LegendDot({
  status,
  label
}: {
  status: PropertyStatus
  label: string
}): JSX.Element {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: statusColor(status) }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  )
}

function statusColor(status: PropertyStatus): string {
  if (status === 'active') return colors.success
  if (status === 'occupied') return colors.gold
  if (status === 'pending') return colors.warn
  return colors.danger
}

function statusLabel(status: PropertyStatus): string {
  if (status === 'active') return 'hai'
  if (status === 'occupied') return 'imepangishwa'
  if (status === 'pending') return 'subiri'
  return 'imekwisha'
}

function normalize(feature: PortfolioFeature, index: number): NormalizedProperty {
  const props = feature.properties ?? {}
  const layer: FeatureLayer = props['layer'] === 'lease' ? 'lease' : 'property'
  const rawIdValue = props['id']
  const rawId = typeof rawIdValue === 'string' ? rawIdValue : null
  const id = rawId ?? `feature-${index}`
  const numberValue = props['number']
  const nameValue = props['name']
  const label =
    layer === 'lease' && typeof numberValue === 'string'
      ? numberValue
      : typeof nameValue === 'string' && nameValue.length > 0
        ? nameValue
        : id.slice(0, 8)
  const region = pickRegion(feature)
  const unitValue = props['unit'] ?? props['unitLabel']
  const unitLabel = typeof unitValue === 'string' && unitValue.length > 0
    ? unitValue
    : COPY.unknown
  const rawStatus = pickStatus(props)
  return {
    id,
    label,
    region,
    unitLabel,
    layer,
    status: mapStatus(rawStatus, props),
    rawStatus: rawStatus ?? ''
  }
}

function pickStatus(props: Readonly<Record<string, unknown>>): string | null {
  const value = props['status']
  return typeof value === 'string' ? value : null
}

function pickRegion(feature: PortfolioFeature): string {
  const props = feature.properties ?? {}
  const candidates = ['region', 'district', 'province', 'phase'] as const
  for (const key of candidates) {
    const value = props[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return COPY.unknown
}

function mapStatus(
  raw: string | null,
  props: Readonly<Record<string, unknown>>
): PropertyStatus {
  if (!raw) return 'pending'
  const normalized = raw.toLowerCase()
  if (normalized === 'expired' || normalized === 'cancelled' || normalized === 'revoked') {
    return 'expired'
  }
  if (normalized === 'pending' || normalized === 'pending_review' || normalized === 'submitted') {
    return 'pending'
  }
  if (normalized === 'occupied' || normalized === 'let' || normalized === 'tenanted') {
    return 'occupied'
  }
  if (normalized === 'active' || normalized === 'approved' || normalized === 'valid' || normalized === 'vacant') {
    return 'active'
  }
  const expiry = props['expiryDate']
  if (typeof expiry === 'string') {
    const expiryMs = Date.parse(expiry)
    if (Number.isFinite(expiryMs) && expiryMs < Date.now()) return 'expired'
  }
  return 'pending'
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
  mapBox: {
    backgroundColor: colors.earth100,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  mapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  polygon: {
    width: '31%',
    minHeight: 70,
    borderRadius: radius.md,
    padding: spacing.sm,
    justifyContent: 'center'
  },
  polygonPressed: {
    opacity: 0.8
  },
  polygonSelected: {
    borderWidth: 3,
    borderColor: colors.earth900
  },
  polygonLabel: {
    color: colors.textInverse,
    fontSize: fontSize.lead,
    fontWeight: '800'
  },
  polygonRegion: {
    color: colors.textInverse,
    fontSize: fontSize.caption,
    marginTop: spacing.xs
  },
  legend: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill
  },
  legendLabel: {
    color: colors.text,
    fontSize: fontSize.caption,
    fontWeight: '600'
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  chipActive: {
    backgroundColor: colors.earth700,
    borderColor: colors.earth700
  },
  chipPressed: {
    opacity: 0.7
  },
  chipLabel: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600'
  },
  chipLabelActive: {
    color: colors.textInverse
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.md
  },
  rowSelected: {
    borderWidth: 2,
    borderColor: colors.gold
  },
  rowPressed: {
    opacity: 0.85
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: radius.pill
  },
  rowBody: {
    flex: 1
  },
  rowTitle: {
    color: colors.text,
    fontSize: fontSize.lead,
    fontWeight: '700'
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    marginTop: spacing.xs
  }
})
