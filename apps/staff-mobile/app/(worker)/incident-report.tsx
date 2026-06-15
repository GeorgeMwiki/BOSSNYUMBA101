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
import { request } from '../../src/api/client'
import { API_BASE_URL } from '../../src/api/config'
import { colors } from '../../src/theme/colors'
import { fontSize, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'W-INC'

// POST /api/v1/cases — the severity-escalator service. `api` is mounted at
// `/api/v1` in services/api-gateway/src/index.ts and `casesRouter` at
// `/cases`, so the create endpoint is `${API_BASE_URL}/api/v1/cases`. The
// gateway derives tenant + actor from the bearer JWT (added by the shared
// `request` client) — the body never carries identity.
const CASES_CREATE_URL = `${API_BASE_URL}/api/v1/cases`

// `case_type` enum value for a workforce safety incident (cases.hono.ts
// CASE_TYPES). The escalator fans out manager/owner/admin off the severity.
const CASE_TYPE_SAFETY = 'safety_concern'

type Severity = 'low' | 'medium' | 'high' | 'critical'

// The case-create response envelope we care about: the human-facing
// reference shown on the receipt. Everything else is ignored.
interface CaseCreateResponse {
  readonly success?: boolean
  readonly data?: { readonly caseNumber?: string | null }
}

type Copy = {
  readonly receivedTitle: string
  readonly receivedSubtitle: string
  readonly referenceLabel: string
  readonly title: string
  readonly subtitle: string
  readonly severityLabel: string
  readonly low: string
  readonly medium: string
  readonly high: string
  readonly critical: string
  readonly sending: string
  readonly errorTitle: string
  readonly errorSubtitle: string
  readonly retry: string
  // Body sent to the gateway — strictly single-language per active locale so
  // the persisted case title/description never mixes EN/SW.
  readonly caseTitle: string
  readonly caseDescription: string
}

const STRINGS: Record<Lang, Copy> = {
  en: {
    receivedTitle: 'Received',
    receivedSubtitle: 'Your manager will see this report immediately.',
    referenceLabel: 'Reference',
    title: 'Report an incident',
    subtitle: 'Tap the severity. Your manager sees it instantly.',
    severityLabel: 'Severity',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'CRITICAL',
    sending: 'Sending…',
    errorTitle: 'Not sent',
    errorSubtitle: 'We could not reach your manager. Tap to try again.',
    retry: 'Try again',
    caseTitle: 'Safety incident reported from the field',
    caseDescription: 'Worker-reported safety incident submitted from the staff app.',
  },
  sw: {
    receivedTitle: 'Imepokelewa',
    receivedSubtitle: 'Meneja wako ataona ripoti yako mara moja.',
    referenceLabel: 'Kumbukumbu',
    title: 'Ripoti tukio',
    subtitle: 'Bonyeza kiwango cha hatari. Meneja ataona haraka.',
    severityLabel: 'Kiwango cha hatari',
    low: 'Chini',
    medium: 'Wastani',
    high: 'Juu',
    critical: 'HATARI',
    sending: 'Inatuma…',
    errorTitle: 'Haijatumwa',
    errorSubtitle: 'Hatukuweza kumfikia meneja wako. Bonyeza kujaribu tena.',
    retry: 'Jaribu tena',
    caseTitle: 'Tukio la usalama limeripotiwa kutoka eneo la kazi',
    caseDescription: 'Tukio la usalama lililoripotiwa na mfanyakazi kupitia programu ya wafanyakazi.',
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

type Phase = 'idle' | 'sending' | 'error' | 'received'

/**
 * Stable idempotency key for one logical incident submission. Generated once
 * per tap and REUSED across retries so an at-least-once re-POST (the user
 * taps "Try again" after a response was lost) cannot create a duplicate case.
 * No Web Crypto in React Native — uniqueness, not unpredictability, is what
 * matters for an idempotency key.
 */
function newIdempotencyKey(): string {
  // eslint-disable-next-line no-restricted-syntax -- RN incident idempotency key (no Web Crypto); uniqueness suffices, not security-sensitive
  const rand = Math.random().toString(36).slice(2, 12)
  return `inc_${Date.now()}_${rand}`
}

function ReportView(): JSX.Element {
  const { lang } = useI18n()
  const copy = STRINGS[lang]
  const [phase, setPhase] = useState<Phase>('idle')
  const [pending, setPending] = useState<{
    readonly severity: Severity
    readonly idempotencyKey: string
  } | null>(null)
  const [reference, setReference] = useState<string | null>(null)

  // Create the case against the severity-escalator. NEVER flips to
  // "received" unless the gateway accepted the write (2xx); any failure
  // surfaces an error + retry so the worker is never told a critical
  // safety report was received when it was silently dropped.
  const submit = async (
    severity: Severity,
    idempotencyKey: string,
  ): Promise<void> => {
    setPhase('sending')
    try {
      const response = await request<CaseCreateResponse>(CASES_CREATE_URL, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: {
          title: copy.caseTitle,
          description: copy.caseDescription,
          type: CASE_TYPE_SAFETY,
          severity,
        },
      })
      setReference(response.data?.caseNumber ?? null)
      setPhase('received')
    } catch (error) {
      // Keep the pending submission (same idempotency key) so "Try again"
      // re-POSTs idempotently rather than minting a duplicate case.
      console.error('Incident report submit failed:', error)
      setPhase('error')
    }
  }

  const onPress = (severity: Severity): void => {
    const idempotencyKey = newIdempotencyKey()
    setPending({ severity, idempotencyKey })
    void submit(severity, idempotencyKey)
  }

  const onRetry = (): void => {
    if (!pending) return
    void submit(pending.severity, pending.idempotencyKey)
  }

  if (phase === 'received') {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{copy.receivedTitle}</Text>
        <Text style={styles.subtitle}>{copy.receivedSubtitle}</Text>
        {reference ? (
          <Text style={styles.reference}>
            {copy.referenceLabel}: {reference}
          </Text>
        ) : null}
      </View>
    )
  }

  if (phase === 'error') {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{copy.errorTitle}</Text>
        <Text style={styles.subtitle}>{copy.errorSubtitle}</Text>
        <Button label={copy.retry} onPress={onRetry} variant="danger" />
      </View>
    )
  }

  const sending = phase === 'sending'

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.subtitle}>{sending ? copy.sending : copy.subtitle}</Text>

      <Section title={copy.severityLabel}>
        <View style={styles.grid}>
          <Button label={copy.low} onPress={() => onPress('low')} variant="ghost" loading={sending} disabled={sending} />
          <Button label={copy.medium} onPress={() => onPress('medium')} variant="ghost" loading={sending} disabled={sending} />
          <Button label={copy.high} onPress={() => onPress('high')} loading={sending} disabled={sending} />
          <Button label={copy.critical} onPress={() => onPress('critical')} variant="danger" loading={sending} disabled={sending} />
        </View>
      </Section>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.text, fontSize: fontSize.h2, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.body },
  reference: { color: colors.textMuted, fontSize: fontSize.body, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
})
