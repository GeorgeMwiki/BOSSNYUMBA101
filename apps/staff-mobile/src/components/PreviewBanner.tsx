import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme/colors'
import { fontSize, radius, spacing } from '../theme/spacing'
import { useI18n } from '../i18n/useI18n'
import type { Lang } from '../auth/types'

export type PreviewBannerKind = 'env-missing' | 'no-data' | 'offline'

export interface PreviewBannerProps {
  readonly kind: PreviewBannerKind
}

/**
 * Honest-UX banner surfacing real failure modes (no fake-data affordance).
 * Three kinds: backend unconfigured, empty endpoint, device offline.
 *
 * Copy is inlined as a frozen per-locale const map. The banner renders ONLY
 * the active locale's string (resolved via `useI18n`) — never both — so the
 * absolute language toggle holds on every error/empty/offline state.
 */
export const BANNER_COPY = Object.freeze({
  'env-missing': Object.freeze({
    sw: 'BossNyumba haijaunganishwa na seva. Wasiliana na msimamizi.',
    en: 'BossNyumba is not connected to the backend.'
  }),
  'no-data': Object.freeze({
    sw: 'Hakuna data bado kwa akaunti yako.',
    en: 'No data yet on your account.'
  }),
  offline: Object.freeze({
    sw: 'Uko nje ya mtandao. Tutasync ukirudi.',
    en: "You are offline. We'll sync when you reconnect."
  })
}) as Readonly<Record<PreviewBannerKind, Readonly<{ sw: string; en: string }>>>

export function bannerCopy(kind: PreviewBannerKind, lang: Lang): string {
  return BANNER_COPY[kind][lang]
}

export function PreviewBanner({ kind }: PreviewBannerProps): JSX.Element {
  const { lang } = useI18n()
  const message = bannerCopy(kind, lang)
  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={message}
      testID={`preview-banner-${kind}`}
      style={[styles.wrap, kindStyle(kind)]}
    >
      <Text style={styles.label}>{message}</Text>
    </View>
  )
}

function kindStyle(kind: PreviewBannerKind): { backgroundColor: string; borderColor: string } {
  if (kind === 'offline') {
    return { backgroundColor: colors.earth700, borderColor: colors.danger }
  }
  if (kind === 'no-data') {
    return { backgroundColor: colors.earth700, borderColor: 'rgba(255, 255, 255, 0.18)' }
  }
  return { backgroundColor: colors.earth700, borderColor: colors.gold }
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  label: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700'
  }
})
