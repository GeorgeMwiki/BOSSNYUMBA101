import { useCallback, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../../theme/colors'
import { fontSize, radius, spacing } from '../../theme/spacing'
import { PreviewBanner } from '../../components/PreviewBanner'
import { enqueueWrite } from '../../sync/queue'
import { useI18n } from '../../i18n/useI18n'
import type { Lang } from '../../auth/types'
import { PRIMARY_CTA_DP, type AttendanceShift } from './types'

export interface ShiftStatusHeroProps {
  readonly shift: AttendanceShift | undefined
  readonly loading: boolean
  readonly error: Error | null
  readonly online: boolean
  readonly userId: string | null
}

/**
 * Single-language-per-locale copy for the shift hero. The active locale
 * (from `useI18n`) selects ONE language — never both — per the CLAUDE.md
 * hard rule (no "Anza zamu / Start shift" mixing). Mirrors the
 * `home/manager/copy.ts` bilingual map pattern until the per-screen i18n
 * catalogue entry lands.
 */
const SHIFT_COPY = Object.freeze({
  loadingShift: { sw: 'Inapakia hali ya zamu…', en: 'Loading shift…' },
  site: { sw: 'Eneo', en: 'Site' },
  startShift: { sw: 'Anza zamu', en: 'Start shift' },
  startShiftAt: { sw: 'Anza zamu', en: 'Start shift' },
  start: { sw: 'Anza', en: 'Start' },
  shiftInProgress: { sw: 'Zamu inaendelea', en: 'Shift in progress' },
  endShift: { sw: 'Maliza zamu', en: 'End shift' },
  end: { sw: 'Maliza', en: 'End' },
  shiftEnded: { sw: 'Zamu imeisha leo', en: 'Shift ended for today' },
  shiftStatus: { sw: 'Hali ya zamu', en: 'Shift status' },
})

function copy(key: keyof typeof SHIFT_COPY, lang: Lang): string {
  const entry = SHIFT_COPY[key]
  return lang === 'sw' ? entry.sw : entry.en
}

function elapsedLabel(seconds: number): string {
  if (seconds <= 0) {
    return '0:00'
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const minPad = minutes.toString().padStart(2, '0')
  return `${hours}:${minPad}`
}

export function ShiftStatusHero({
  shift,
  loading,
  error,
  online,
  userId
}: ShiftStatusHeroProps): JSX.Element {
  const { lang } = useI18n()
  const onClockIn = useCallback((): void => {
    if (!userId) {
      return
    }
    void enqueueWrite('attendance', { action: 'clock_in', userId, occurredAt: Date.now() })
  }, [userId])

  const onClockOut = useCallback((): void => {
    if (!userId) {
      return
    }
    void enqueueWrite('attendance', { action: 'clock_out', userId, occurredAt: Date.now() })
  }, [userId])

  const body = useMemo<JSX.Element>(() => {
    if (loading) {
      return <Text style={styles.lead}>{copy('loadingShift', lang)}</Text>
    }
    if (error) {
      return <PreviewBanner kind="env-missing" />
    }
    if (!shift) {
      return <PreviewBanner kind="no-data" />
    }
    const siteName = shift.siteName ?? copy('site', lang)
    if (shift.state === 'not-started') {
      return (
        <View>
          <Text style={styles.headline}>{copy('startShift', lang)}</Text>
          <Text style={styles.sub}>{`${copy('startShiftAt', lang)} · ${siteName}`}</Text>
          <Pressable
            onPress={onClockIn}
            accessibilityRole="button"
            accessibilityLabel={copy('startShift', lang)}
            style={({ pressed }) => [styles.cta, pressed ? styles.ctaPressed : null]}
            testID="employee-home-clock-in"
          >
            <Text style={styles.ctaText}>{copy('start', lang)}</Text>
          </Pressable>
        </View>
      )
    }
    if (shift.state === 'in-progress' || shift.state === 'on-break') {
      return (
        <View>
          <Text style={styles.timer}>{elapsedLabel(shift.elapsedSeconds)}</Text>
          <Text style={styles.sub}>
            {`${copy('shiftInProgress', lang)} · ${siteName}`}
          </Text>
          <Pressable
            onPress={onClockOut}
            accessibilityRole="button"
            accessibilityLabel={copy('endShift', lang)}
            style={({ pressed }) => [styles.ctaSecondary, pressed ? styles.ctaPressed : null]}
            testID="employee-home-clock-out"
          >
            <Text style={styles.ctaSecondaryText}>{copy('end', lang)}</Text>
          </Pressable>
        </View>
      )
    }
    return <Text style={styles.lead}>{copy('shiftEnded', lang)}</Text>
  }, [loading, error, shift, onClockIn, onClockOut, lang])

  return (
    <View
      style={[styles.wrap, online ? null : styles.wrapOffline]}
      accessibilityLabel={copy('shiftStatus', lang)}
    >
      {body}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.earth900,
    padding: spacing.lg,
    borderRadius: radius.lg,
    minHeight: 200
  },
  wrapOffline: {
    borderWidth: 2,
    borderColor: colors.warn
  },
  headline: {
    color: colors.textInverse,
    fontSize: fontSize.h1,
    fontWeight: '700'
  },
  timer: {
    color: colors.goldLight,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 1
  },
  sub: {
    color: colors.earth100,
    fontSize: fontSize.lead,
    marginTop: spacing.xs
  },
  lead: {
    color: colors.textInverse,
    fontSize: fontSize.lead
  },
  cta: {
    marginTop: spacing.lg,
    minHeight: PRIMARY_CTA_DP,
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl
  },
  ctaSecondary: {
    marginTop: spacing.lg,
    minHeight: PRIMARY_CTA_DP,
    backgroundColor: colors.earth500,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderWidth: 2,
    borderColor: colors.goldLight
  },
  ctaPressed: {
    opacity: 0.85
  },
  ctaText: {
    color: colors.earth900,
    fontSize: fontSize.h2,
    fontWeight: '800'
  },
  ctaSecondaryText: {
    color: colors.textInverse,
    fontSize: fontSize.h2,
    fontWeight: '800'
  }
})
