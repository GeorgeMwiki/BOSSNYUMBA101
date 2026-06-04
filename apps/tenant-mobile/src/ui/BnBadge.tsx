import { StyleSheet, Text, View } from 'react-native'
import { tokens } from './tokens'

export type BnBadgeTone = 'neutral' | 'gold' | 'success' | 'warn' | 'danger' | 'info'

export interface BnBadgeProps {
  readonly label: string
  readonly tone?: BnBadgeTone
  readonly size?: 'sm' | 'md'
  readonly uppercase?: boolean
}

/**
 * Status pill — BossNyumba badge family. Uses 12% tone tint on a navy
 * background with the tone's full-saturation text — same recipe used
 * across the BossNyumba web borrower dashboard.
 */
export function BnBadge({
  label,
  tone = 'neutral',
  size = 'sm',
  uppercase = true
}: BnBadgeProps): JSX.Element {
  const palette = toneStyles[tone]
  return (
    <View style={[
      styles.pill,
      { backgroundColor: palette.bg, borderColor: palette.border },
      size === 'md' ? styles.pillMd : styles.pillSm
    ]}>
      <Text style={[
        styles.label,
        { color: palette.fg, fontSize: size === 'md' ? 12 : 11 },
        uppercase ? styles.upper : null
      ]}>
        {label}
      </Text>
    </View>
  )
}

const toneStyles: Record<BnBadgeTone, { bg: string; border: string; fg: string }> = {
  neutral: { bg: 'rgba(255, 255, 255, 0.06)', border: tokens.color.border, fg: tokens.color.textSecondary },
  gold: { bg: 'rgba(255, 200, 87, 0.14)', border: tokens.color.borderAccent, fg: tokens.color.accent },
  success: { bg: 'rgba(46, 189, 133, 0.16)', border: 'rgba(46, 189, 133, 0.32)', fg: tokens.color.success },
  warn: { bg: 'rgba(255, 200, 87, 0.14)', border: tokens.color.borderAccent, fg: tokens.color.warn },
  danger: { bg: 'rgba(225, 75, 75, 0.14)', border: 'rgba(225, 75, 75, 0.36)', fg: tokens.color.danger },
  info: { bg: 'rgba(255, 255, 255, 0.08)', border: tokens.color.borderStrong, fg: tokens.color.textPrimary }
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    borderWidth: 1
  },
  pillSm: { paddingHorizontal: tokens.space.sm, paddingVertical: 3 },
  pillMd: { paddingHorizontal: tokens.space.md, paddingVertical: 5 },
  label: { fontWeight: '700', letterSpacing: 0.3 },
  upper: { textTransform: 'uppercase' }
})
