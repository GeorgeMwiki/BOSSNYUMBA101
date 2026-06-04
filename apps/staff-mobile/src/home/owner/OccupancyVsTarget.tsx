import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../../theme/colors'
import { fontSize, radius, spacing } from '../../theme/spacing'
import { classifyDelta, formatDelta, formatUnits } from './format'
import type { OccupancyPillar } from './types'

export interface OccupancyVsTargetProps {
  readonly occupancy: OccupancyPillar
  readonly lang: 'sw' | 'en'
}

/**
 * Slot 4 — Occupancy pillar. Per-property list with delta vs target. Spec
 * §C drill-down ladder caps at 3 levels: this is Level-2 inline (summary
 * → segment list). Property rows are tappable in a later wave; here they
 * remain accessible read-only summaries with explicit status text.
 */
export function OccupancyVsTarget({ occupancy, lang }: OccupancyVsTargetProps): JSX.Element {
  const properties = occupancy.perProperty
  return (
    <View testID="owner-home-occupancy" style={styles.wrap}>
      <Text style={styles.header}>
        {lang === 'sw' ? 'Ukaaji kwa mali' : 'Occupancy by property'}
      </Text>
      {properties.length === 0 ? (
        <Text style={styles.empty}>
          {lang === 'sw' ? 'Hakuna ripoti bado.' : 'No reports yet.'}
        </Text>
      ) : (
        properties.map((property) => {
          const delta = property.target > 0 ? ((property.occupied - property.target) / property.target) * 100 : 0
          const status = classifyDelta(delta)
          return (
            <View
              key={property.propertyId}
              accessibilityRole="summary"
              accessibilityLabel={`${property.propertyName} · ${formatUnits(property.occupied)} · ${formatDelta(delta)}`}
              style={styles.row}
            >
              <View style={styles.rowMain}>
                <Text style={styles.propertyName}>{property.propertyName}</Text>
                <Text style={styles.occupied}>{formatUnits(property.occupied)}</Text>
              </View>
              <View style={styles.rowMeta}>
                <Text style={[styles.delta, deltaTone(status)]}>{formatDelta(delta)}</Text>
                <Text style={styles.target}>
                  {lang === 'sw' ? 'Lengo' : 'Target'}: {formatUnits(property.target)}
                </Text>
              </View>
            </View>
          )
        })
      )}
    </View>
  )
}

function deltaTone(status: ReturnType<typeof classifyDelta>): { color: string } {
  if (status === 'danger') {
    return { color: colors.danger }
  }
  if (status === 'warn') {
    return { color: colors.warn }
  }
  return { color: colors.success }
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg
  },
  header: {
    color: colors.text,
    fontSize: fontSize.h3,
    fontWeight: '700',
    marginBottom: spacing.sm
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    fontStyle: 'italic'
  },
  row: {
    backgroundColor: colors.earth700,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: 48
  },
  rowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  propertyName: {
    color: colors.text,
    fontSize: fontSize.lead,
    fontWeight: '700'
  },
  occupied: {
    color: colors.gold,
    fontSize: fontSize.h3,
    fontWeight: '800'
  },
  rowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs
  },
  delta: {
    fontSize: fontSize.body,
    fontWeight: '700'
  },
  target: {
    color: colors.textMuted,
    fontSize: fontSize.caption
  }
})
