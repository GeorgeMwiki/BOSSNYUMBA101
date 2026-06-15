import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { FingerprintPlaceholder } from '../../src/components/FingerprintPlaceholder'
import { RoleGuard } from '../../src/components/RoleGuard'
import { PreviewBanner } from '../../src/components/PreviewBanner'
import { managerApi } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { useOnlineStatus } from '../../src/offline/useOnlineStatus'
import { useAuth } from '../../src/auth/useAuth'
import { enqueueWrite } from '../../src/sync/queue'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'W-M-03'
// FLAGGED (unresolved): pre-shift safety briefings have no dedicated
// property-domain resource. Recommendation: fold daily briefings into
// /api/v1/notifications (broadcast). Kept as a permanent env-missing state.
const MISSING_ENDPOINT = 'GET /api/v1/notifications (safety briefings)'

const COPY = {
  loading: 'Inapakia mada za usalama... · Loading briefing topics...',
  empty: 'Hakuna mada za usalama bado. · No safety topics yet.',
  errorPrefix: 'Hitilafu: ',
  missing: `Endpoint haijaundwa: ${MISSING_ENDPOINT}`,
  ackOk: 'Briefing imethibitishwa kwenye seva.',
  ackQueued: 'Briefing imehifadhiwa kwa sync ya baadaye.'
} as const

interface CheckInRequest {
  readonly employeeId: string
  readonly propertyId: string
  readonly workDate: string
  readonly shiftKind: 'day' | 'night'
  readonly lat: number
  readonly lon: number
  readonly withinFence: boolean
  readonly fingerprintEventId?: string
}

interface AttendanceRow {
  readonly id: string
}

// HTTP statuses where the server understood and rejected the BODY — re-sending
// loops forever, so these are NOT queued (they surface as a real error).
// Mirrors flush.ts POISON_STATUSES so an online failure and a queued flush make
// the identical drop-vs-retain decision.
const POISON_STATUSES = new Set<number>([400, 401, 403, 409, 413, 422])

/**
 * Queue the briefing-sign offline when offline OR on a transient/deploy-gap
 * status (network status 0, 404 route-missing, 405 wrong-verb, 408/429, 5xx) —
 * flush.ts `shouldDrop` RETAINS exactly these, so a worker hitting a deploy gap
 * keeps their signed briefing. Genuine poison (400/401/403/409/413/422) is the
 * body's fault — do not queue; surface the error.
 */
function shouldQueueOffline(error: ApiError, online: boolean): boolean {
  if (!online) return true
  if (error.status === 0) return true
  return !POISON_STATUSES.has(error.status)
}

export default function Screen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <BriefingView />
      </ScreenShell>
    </RoleGuard>
  )
}

function BriefingView(): JSX.Element {
  const { user } = useAuth()
  const { online } = useOnlineStatus()
  const [signedFlag, setSignedFlag] = useState<'idle' | 'ok' | 'queued'>('idle')

  const mutation = useMutation<AttendanceRow, ApiError, CheckInRequest>({
    mutationFn: async (input) =>
      // Mounted route is POST /attendance (captureHandler('attendance')); the
      // briefing-sign is a fingerprint-signed shift start, so `kind` is folded
      // into the BODY exactly as the offline enqueue does.
      managerApi
        .post<{ success: true; data: AttendanceRow }>('/attendance', {
          ...input,
          kind: 'check-in'
        })
        .then((r) => r.data),
    onSuccess: () => {
      setSignedFlag('ok')
    },
    onError: async (error, input) => {
      // Queue offline AND on a 404/405/5xx deploy gap — flush.ts shouldDrop
      // retains those, so a signed briefing survives a missing route instead of
      // dead-ending. Only genuine poison falls through to the surfaced error.
      if (shouldQueueOffline(error, online)) {
        await enqueueWrite('attendance', { ...input, kind: 'check-in' })
        setSignedFlag('queued')
      }
    }
  })

  const onSign = useCallback((): void => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    mutation.mutate({
      employeeId: user.id,
      propertyId: user.tenantId,
      workDate: today,
      shiftKind: 'day',
      lat: 0,
      lon: 0,
      withinFence: true,
      fingerprintEventId: `fp-briefing-${Date.now()}`
    })
  }, [mutation, user])

  const submitting = mutation.isPending
  const submitError = mutation.error
  const submitNetwork = submitError?.status === 0 || !online
  const submitMissing = submitError?.status === 503
  // A queued sign (network / 404 / 405 / 5xx deploy-gap) was retained for sync —
  // show only the "saved for sync" box, never a contradictory hard error.
  const queuedOffline = signedFlag === 'queued'
  const successCopy = useMemo<string | null>(() => {
    if (signedFlag === 'ok') return COPY.ackOk
    if (signedFlag === 'queued') return COPY.ackQueued
    return null
  }, [signedFlag])

  return (
    <View>
      <Section title="Mada za usalama">
        <PreviewBanner kind="env-missing" />
        <Text style={styles.missing}>{COPY.missing}</Text>
        <Text style={styles.empty}>{COPY.empty}</Text>
      </Section>
      <Section title="Thibitisha kwa kidole">
        {signedFlag === 'idle' ? (
          submitting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.loadingText}>{COPY.loading}</Text>
            </View>
          ) : (
            <FingerprintPlaceholder label="Saini briefing" onSign={onSign} />
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={successCopy ?? ''}
            onPress={() => undefined}
            style={styles.signedBox}
          >
            <Text style={styles.signedText}>{successCopy}</Text>
          </Pressable>
        )}
        {submitError && !submitNetwork && !submitMissing && !queuedOffline ? (
          <Text style={styles.errorText}>{COPY.errorPrefix}{submitError.message}</Text>
        ) : null}
        {submitNetwork ? <PreviewBanner kind="offline" /> : null}
        {submitMissing ? <PreviewBanner kind="env-missing" /> : null}
      </Section>
    </View>
  )
}

const styles = StyleSheet.create({
  missing: {
    color: colors.warn,
    fontSize: fontSize.caption,
    fontWeight: '700',
    marginBottom: spacing.sm
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.body
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.earth100,
    borderRadius: radius.md,
    gap: spacing.md
  },
  loadingText: {
    color: colors.earth700,
    fontSize: fontSize.body
  },
  signedBox: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.success
  },
  signedText: {
    color: colors.success,
    fontSize: fontSize.lead,
    fontWeight: '700'
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.body,
    marginTop: spacing.sm
  }
})
