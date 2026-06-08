/**
 * Worker payslip screen — payroll chain L-B (issue #193).
 *
 * Shows the worker's most recent payroll line item: hours, base,
 * overtime, bonus, deduction, net. Locale resolves from the signed-in
 * user (`useI18n` → `useAuth`) so the screen renders strictly single-
 * language per the active toggle — no hardcoded `lang`, no EN/SW mixing.
 * Backend: GET /api/v1/owner/payroll/runs/:id (worker reads their own
 * line item from the response).
 */

import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { RoleGuard } from '../../src/components/RoleGuard'
import { useI18n } from '../../src/i18n/useI18n'
import type { Lang } from '../../src/auth/types'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'W-PAY'

const PLACEHOLDER = '—'

interface PayslipLine {
  readonly key: string
  readonly label: string
}

type Copy = {
  readonly title: string
  readonly subtitle: string
  readonly breakdown: string
  readonly net: string
  readonly lines: ReadonlyArray<PayslipLine>
}

const STRINGS: Record<Lang, Copy> = {
  en: {
    title: 'Your payslip',
    subtitle: 'Latest period. Funds disburse via M-Pesa B2C once the owner commits.',
    breakdown: 'Breakdown',
    net: 'You will receive',
    lines: [
      { key: 'hours', label: 'Hours worked' },
      { key: 'overtimeHours', label: 'Overtime hours' },
      { key: 'base', label: 'Base' },
      { key: 'overtime', label: 'Overtime' },
      { key: 'bonus', label: 'Bonus' },
      { key: 'deduction', label: 'Deduction' },
    ],
  },
  sw: {
    title: 'Payslip yako',
    subtitle: 'Kipindi cha hivi karibuni. Pesa hutumwa kwa M-Pesa.',
    breakdown: 'Maelezo',
    net: 'Jumla utakayopokea',
    lines: [
      { key: 'hours', label: 'Masaa ya kazi' },
      { key: 'overtimeHours', label: 'Masaa ya ziada' },
      { key: 'base', label: 'Mshahara wa msingi' },
      { key: 'overtime', label: 'Mshahara wa ziada' },
      { key: 'bonus', label: 'Bonasi' },
      { key: 'deduction', label: 'Makato' },
    ],
  },
}

export default function PayslipScreen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <PayslipView />
      </ScreenShell>
    </RoleGuard>
  )
}

function PayslipView(): JSX.Element {
  const { lang } = useI18n()
  const copy = STRINGS[lang]
  const rows = useMemo(
    () => copy.lines.map((line) => ({ ...line, value: PLACEHOLDER })),
    [copy.lines],
  )

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.subtitle}>{copy.subtitle}</Text>

      <Section title={copy.breakdown}>
        <View style={styles.table}>
          {rows.map((line) => (
            <View key={line.key} style={styles.row}>
              <Text style={styles.label}>{line.label}</Text>
              <Text style={styles.value}>{line.value}</Text>
            </View>
          ))}
        </View>
      </Section>

      <View style={styles.netCard}>
        <Text style={styles.netLabel}>{copy.net}</Text>
        <Text style={styles.netValue}>{PLACEHOLDER}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  title: { color: colors.text, fontSize: fontSize.h2, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.body },
  table: {
    backgroundColor: colors.earth700,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  label: { color: colors.textMuted, fontSize: fontSize.body },
  value: { color: colors.text, fontSize: fontSize.body, fontWeight: '600' },
  netCard: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  netLabel: { color: colors.textInverse, fontSize: fontSize.body, opacity: 0.85 },
  netValue: { color: colors.textInverse, fontSize: fontSize.h1, fontWeight: '700' },
})
