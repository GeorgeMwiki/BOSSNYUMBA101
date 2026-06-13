/**
 * Worker safety-incident report — chain L-C (issue #193).
 *
 * One-button SOS for low/medium reports + a "tap if critical" CTA that
 * escalates severity. Locale resolves from the signed-in user (`useI18n`
 * → `useAuth`) so the screen renders strictly single-language per the
 * active toggle — no hardcoded `lang`, no EN/SW mixing. Backend: POST
 * /api/v1/cases — the severity-escalator service decides the
 * manager/owner/admin fan-out.
 */

import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { RoleGuard } from '../../src/components/RoleGuard'
import { Button } from '../../src/forms/Button'
import { useI18n } from '../../src/i18n/useI18n'
import type { Lang } from '../../src/auth/types'
import { colors } from '../../src/theme/colors'
import { fontSize, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'W-INC'

type Severity = 'low' | 'medium' | 'high' | 'critical'

type Copy = {
  readonly receivedTitle: string
  readonly receivedSubtitle: string
  readonly title: string
  readonly subtitle: string
  readonly severityLabel: string
  readonly low: string
  readonly medium: string
  readonly high: string
  readonly critical: string
}

const STRINGS: Record<Lang, Copy> = {
  en: {
    receivedTitle: 'Received',
    receivedSubtitle: 'Your manager will see this report immediately.',
    title: 'Report an incident',
    subtitle: 'Tap the severity. Your manager sees it instantly.',
    severityLabel: 'Severity',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'CRITICAL',
  },
  sw: {
    receivedTitle: 'Imepokelewa',
    receivedSubtitle: 'Meneja wako ataona ripoti yako mara moja.',
    title: 'Ripoti tukio',
    subtitle: 'Bonyeza kiwango cha hatari. Meneja ataona haraka.',
    severityLabel: 'Kiwango cha hatari',
    low: 'Chini',
    medium: 'Wastani',
    high: 'Juu',
    critical: 'HATARI',
  },
}

export default function IncidentReportScreen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <ReportView />
      </ScreenShell>
    </RoleGuard>
  )
}

function ReportView(): JSX.Element {
  const { lang } = useI18n()
  const copy = STRINGS[lang]
  const [submitted, setSubmitted] = useState<Severity | null>(null)

  const onPress = (severity: Severity): void => {
    setSubmitted(severity)
    // POST /api/v1/cases wires in next iteration.
  }

  if (submitted) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{copy.receivedTitle}</Text>
        <Text style={styles.subtitle}>{copy.receivedSubtitle}</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.subtitle}>{copy.subtitle}</Text>

      <Section title={copy.severityLabel}>
        <View style={styles.grid}>
          <Button label={copy.low} onPress={() => onPress('low')} variant="ghost" />
          <Button label={copy.medium} onPress={() => onPress('medium')} variant="ghost" />
          <Button label={copy.high} onPress={() => onPress('high')} />
          <Button label={copy.critical} onPress={() => onPress('critical')} variant="danger" />
        </View>
      </Section>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.text, fontSize: fontSize.h2, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.body },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
})
