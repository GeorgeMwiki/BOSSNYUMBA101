import { StyleSheet, Text, View } from 'react-native'
import { tokens } from './tokens'
import { BnButton } from './BnButton'

export interface BnEmptyStateProps {
  readonly glyph?: string
  readonly title: string
  readonly body?: string
  readonly cta?: { label: string; onPress: () => void }
  readonly tone?: 'neutral' | 'warn' | 'danger'
}

/**
 * BossNyumba-style empty card — soft glyph plate, 1-line title, 1-line body,
 * one CTA. Never a blank screen. Mirrors the BossNyumba web pattern of
 * "soft illustration placeholder + copy + CTA".
 */
export function BnEmptyState({
  glyph,
  title,
  body,
  cta,
  tone = 'neutral'
}: BnEmptyStateProps): JSX.Element {
  const accent = tone === 'danger' ? tokens.color.danger : tone === 'warn' ? tokens.color.warn : tokens.color.gold
  return (
    <View style={styles.wrap}>
      <View style={[styles.glyphPlate, { borderColor: accent }]}>
        <Text style={[styles.glyph, { color: accent }]}>{glyph ?? '·'}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {cta ? (
        <View style={styles.ctaWrap}>
          <BnButton label={cta.label} onPress={cta.onPress} variant="secondary" size="md" />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: tokens.space.xxl,
    paddingHorizontal: tokens.space.lg,
    backgroundColor: tokens.color.bgRaised,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.color.border
  },
  glyphPlate: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.color.bgBase,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.space.lg
  },
  glyph: { fontSize: 28, fontWeight: '700' },
  title: {
    ...tokens.type.h3,
    color: tokens.color.textPrimary,
    textAlign: 'center'
  },
  body: {
    ...tokens.type.body,
    color: tokens.color.textMuted,
    textAlign: 'center',
    marginTop: tokens.space.sm
  },
  ctaWrap: { marginTop: tokens.space.lg }
})
