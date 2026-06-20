import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { RoleGuard } from '../../src/components/RoleGuard'
import { PreviewBanner } from '../../src/components/PreviewBanner'
import { managerApi } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { useOnlineStatus } from '../../src/offline/useOnlineStatus'
import { useAuth } from '../../src/auth/useAuth'
import { useI18n } from '../../src/i18n/useI18n'
import type { Lang } from '../../src/auth/types'
import { enqueueWrite } from '../../src/sync/queue'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'W-M-12'
// Per-self shift state is GET /api/v1/field/staff/me; a whole-crew attendance
// roster (GET /attendance) is NOT implemented, so history stays env-missing.
const MISSING_HISTORY_ENDPOINT = 'GET /api/v1/field/staff (attendance history)'

// Locale-keyed copy. Resolved from the signed-in user via `useI18n` →
// `useAuth` so the screen renders strictly single-language per the active
// toggle — no EN/SW mixing.
type Copy = {
  readonly loading: string
  readonly emptyHistory: string
  readonly errorPrefix: string
  readonly missing: string
  readonly inOk: string
  readonly outOk: string
  readonly queued: string
  readonly shiftStatus: string
  readonly summary: string
  readonly history: string
  readonly start: string
  readonly startHint: string
  readonly stop: string
  readonly stopHint: string
  readonly today: string
  readonly thisWeek: string
  readonly hrs: string
  readonly inProgress: string
  readonly serverSuffix: string
}

const STRINGS: Record<Lang, Copy> = {
  en: {
    loading: 'Submitting…',
    emptyHistory: 'Shift history will not show until the list endpoint is built.',
    errorPrefix: 'Error: ',
    missing: `Endpoint not built: ${MISSING_HISTORY_ENDPOINT}`,
    inOk: 'You are clocked in on the server.',
    outOk: 'You are clocked out on the server.',
    queued: 'Saved offline for sync.',
    shiftStatus: 'Shift status',
    summary: 'Summary',
    history: 'Shift history',
    start: 'Start shift',
    startHint: 'Tap to start your shift',
    stop: 'End shift',
    stopHint: 'Tap to end your shift',
    today: 'Today',
    thisWeek: 'This week',
    hrs: 'hrs',
    inProgress: 'in progress',
    serverSuffix: '(server)',
  },
  sw: {
    loading: 'Inatuma…',
    emptyHistory: 'Historia ya zamu haitaonyeshwa hadi endpoint ya orodha iundwe.',
    errorPrefix: 'Hitilafu: ',
    missing: `Endpoint haijaundwa: ${MISSING_HISTORY_ENDPOINT}`,
    inOk: 'Umeingia kazini kwenye seva.',
    outOk: 'Umetoka kazini kwenye seva.',
    queued: 'Imehifadhiwa offline kwa sync.',
    shiftStatus: 'Hali ya zamu',
    summary: 'Muhtasari',
    history: 'Kumbukumbu ya zamu',
    start: 'Anza Saa',
    startHint: 'Bonyeza ili kuanza zamu',
    stop: 'Mwisho Saa',
    stopHint: 'Bonyeza ili kumaliza zamu',
    today: 'Leo',
    thisWeek: 'Wiki hii',
    hrs: 'saa',
    inProgress: 'inaendelea',
    serverSuffix: '(seva)',
  },
}

interface AttendanceRow {
  readonly id: string
  readonly signedOffAt: string | null
  readonly hoursWorked: string | null
}

interface AttendanceResponse {
  readonly success: true
  readonly data: AttendanceRow
}

interface CheckInPayload {
  readonly employeeId: string
  readonly propertyId: string
  readonly workDate: string
  readonly shiftKind: 'day' | 'night'
  readonly lat: number
  readonly lon: number
  readonly withinFence: boolean
}

interface CheckOutPayload {
  readonly attendanceId: string
  readonly lat: number
  readonly lon: number
  readonly withinFence: boolean
}

interface LocalSegment {
  readonly id: string
  readonly startedAtISO: string
  readonly endedAtISO: string | null
  readonly attendanceId: string | null
  readonly hoursWorked: string | null
}

// HTTP statuses where the server understood and rejected the BODY — re-sending
// would loop forever, so these are NOT queued (they surface as a real error).
// Mirrors flush.ts POISON_STATUSES so an online failure and a queued flush make
// the identical drop-vs-retain decision.
const POISON_STATUSES = new Set<number>([400, 401, 403, 409, 413, 422])

/**
 * Decide whether a failed attendance write should be enqueued offline.
 *
 * Queue when offline OR when the failure is a transient/deploy-gap status
 * (network status 0, 404 route-missing, 405 wrong-verb, 408/429 throttle, any
 * 5xx). flush.ts `shouldDrop` RETAINS exactly these, so a worker who hits a
 * deploy gap while online keeps their clock-in/out instead of dead-ending.
 * Genuine poison (400/401/403/409/413/422) is the body's fault — do not queue;
 * let the screen surface the error.
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
        <HoursLog />
      </ScreenShell>
    </RoleGuard>
  )
}

function HoursLog(): JSX.Element {
  const { user } = useAuth()
  const { lang } = useI18n()
  const copy = STRINGS[lang]
  const { online } = useOnlineStatus()
  const [segments, setSegments] = useState<ReadonlyArray<LocalSegment>>([])
  const [openSegmentId, setOpenSegmentId] = useState<string | null>(null)
  const [notice, setNotice] = useState<'idle' | 'in-ok' | 'out-ok' | 'queued'>('idle')

  const checkInMutation = useMutation<AttendanceRow, ApiError, CheckInPayload>({
    mutationFn: async (input) => {
      // The mounted route is POST /attendance (captureHandler('attendance')).
      // Fold the action into the BODY as `kind` — identical to the shape the
      // offline path enqueues, so an online write and a queued flush converge
      // on the same server contract.
      const resp = await managerApi.post<AttendanceResponse>('/attendance', {
        ...input,
        kind: 'check-in'
      })
      return resp.data
    },
    onSuccess: (row) => {
      const local: LocalSegment = {
        id: row.id,
        startedAtISO: new Date().toISOString(),
        endedAtISO: null,
        attendanceId: row.id,
        hoursWorked: null
      }
      setSegments((prev) => [local, ...prev])
      setOpenSegmentId(row.id)
      setNotice('in-ok')
    },
    onError: async (error, input) => {
      // Queue offline (network, status 0) AND on a deploy gap (404/405/5xx) —
      // flush.ts shouldDrop RETAINS those statuses, so the clock-in survives a
      // missing/unmounted route instead of dead-ending. Only genuine poison
      // (400/401/403/409/413/422) falls through to the surfaced error.
      if (shouldQueueOffline(error, online)) {
        const queued = await enqueueWrite('attendance', { ...input, kind: 'check-in' })
        const local: LocalSegment = {
          id: queued.id,
          startedAtISO: new Date().toISOString(),
          endedAtISO: null,
          attendanceId: null,
          hoursWorked: null
        }
        setSegments((prev) => [local, ...prev])
        setOpenSegmentId(queued.id)
        setNotice('queued')
      }
    }
  })

  const checkOutMutation = useMutation<AttendanceRow, ApiError, CheckOutPayload>({
    mutationFn: async (input) => {
      // Mounted route is POST /attendance; the action is carried as `kind` in
      // the body (matches the offline enqueue shape).
      const resp = await managerApi.post<AttendanceResponse>('/attendance', {
        ...input,
        kind: 'check-out'
      })
      return resp.data
    },
    onSuccess: (row) => {
      setSegments((prev) =>
        prev.map((segment) =>
          segment.attendanceId === row.id
            ? {
                ...segment,
                endedAtISO: row.signedOffAt ?? new Date().toISOString(),
                hoursWorked: row.hoursWorked
              }
            : segment
        )
      )
      setOpenSegmentId(null)
      setNotice('out-ok')
    },
    onError: async (error, input) => {
      // Same retain-on-deploy-gap gate as check-in: queue offline or on a
      // 404/405/5xx so the clock-out is preserved for the next flush.
      if (shouldQueueOffline(error, online)) {
        await enqueueWrite('attendance', { ...input, kind: 'check-out' })
        setSegments((prev) =>
          prev.map((segment) =>
            segment.id === openSegmentId
              ? { ...segment, endedAtISO: new Date().toISOString() }
              : segment
          )
        )
        setOpenSegmentId(null)
        setNotice('queued')
      }
    }
  })

  const clockIn = useCallback((): void => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    checkInMutation.mutate({
      employeeId: user.id,
      propertyId: user.tenantId,
      workDate: today,
      shiftKind: 'day',
      lat: 0,
      lon: 0,
      withinFence: true
    })
  }, [checkInMutation, user])

  const clockOut = useCallback((): void => {
    if (!openSegmentId) return
    const active = segments.find((s) => s.id === openSegmentId)
    if (!active || !active.attendanceId) {
      // Offline-started segment without a server id — close locally only.
      setSegments((prev) =>
        prev.map((segment) =>
          segment.id === openSegmentId
            ? { ...segment, endedAtISO: new Date().toISOString() }
            : segment
        )
      )
      setOpenSegmentId(null)
      setNotice('queued')
      return
    }
    checkOutMutation.mutate({
      attendanceId: active.attendanceId,
      lat: 0,
      lon: 0,
      withinFence: true
    })
  }, [checkOutMutation, openSegmentId, segments])

  const todayHours = useMemo<number>(() => sumHours(segments, isToday), [segments])
  const weekHours = useMemo<number>(() => sumHours(segments, isThisWeek), [segments])

  const clockedIn = openSegmentId !== null
  const submitting = checkInMutation.isPending || checkOutMutation.isPending
  const submitError = checkInMutation.error ?? checkOutMutation.error
  const networkError = submitError?.status === 0 || submitError?.status === 503
  // A queued capture (network / 404 / 405 / 5xx deploy-gap) was retained for
  // sync — show only the "Saved offline" notice, never a contradictory error.
  const queuedOffline = notice === 'queued'

  return (
    <View>
      <Section title={copy.shiftStatus}>
        {submitting ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.muted}>{copy.loading}</Text>
          </View>
        ) : clockedIn ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.stop}
            onPress={clockOut}
            style={({ pressed }) => [styles.bigButton, styles.stop, pressed && styles.pressed]}
          >
            <Text style={styles.bigButtonLabel}>{copy.stop}</Text>
            <Text style={styles.bigButtonHint}>{copy.stopHint}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.start}
            onPress={clockIn}
            style={({ pressed }) => [styles.bigButton, styles.start, pressed && styles.pressed]}
          >
            <Text style={styles.bigButtonLabelDark}>{copy.start}</Text>
            <Text style={styles.bigButtonHintDark}>{copy.startHint}</Text>
          </Pressable>
        )}
        {!online ? <PreviewBanner kind="offline" /> : null}
        {notice === 'in-ok' ? <Text style={styles.successText}>{copy.inOk}</Text> : null}
        {notice === 'out-ok' ? <Text style={styles.successText}>{copy.outOk}</Text> : null}
        {notice === 'queued' ? <Text style={styles.warnText}>{copy.queued}</Text> : null}
        {submitError && !networkError && !queuedOffline ? (
          <Text style={styles.errorText}>{copy.errorPrefix}{submitError.message}</Text>
        ) : null}
      </Section>
      <Section title={copy.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{copy.today}</Text>
            <Text style={styles.summaryValue}>{todayHours.toFixed(1)} {copy.hrs}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{copy.thisWeek}</Text>
            <Text style={styles.summaryValue}>{weekHours.toFixed(1)} {copy.hrs}</Text>
          </View>
        </View>
      </Section>
      <Section title={copy.history}>
        <PreviewBanner kind="env-missing" />
        <Text style={styles.missing}>{copy.missing}</Text>
        {segments.length === 0 ? (
          <Text style={styles.muted}>{copy.emptyHistory}</Text>
        ) : (
          segments.map((segment) => (
            <View key={segment.id} style={styles.segment}>
              <Text style={styles.segmentPrimary}>{formatRange(segment, copy.inProgress)}</Text>
              <Text style={styles.segmentSecondary}>{describeDuration(segment, copy)}</Text>
            </View>
          ))
        )}
      </Section>
    </View>
  )
}

function isToday(iso: string): boolean {
  const then = new Date(iso)
  const now = new Date()
  return (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  )
}

function isThisWeek(iso: string): boolean {
  const then = new Date(iso).getTime()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  return Date.now() - then < sevenDaysMs
}

function sumHours(
  segments: ReadonlyArray<LocalSegment>,
  filter: (iso: string) => boolean
): number {
  return segments
    .filter((segment) => filter(segment.startedAtISO))
    .reduce((total, segment) => {
      const end = segment.endedAtISO ? new Date(segment.endedAtISO).getTime() : Date.now()
      const start = new Date(segment.startedAtISO).getTime()
      return total + Math.max(0, end - start) / (60 * 60 * 1000)
    }, 0)
}

function formatRange(segment: LocalSegment, inProgressLabel: string): string {
  const start = new Date(segment.startedAtISO)
  const end = segment.endedAtISO ? new Date(segment.endedAtISO) : null
  return `${formatTime(start)} – ${end ? formatTime(end) : inProgressLabel}`
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function describeDuration(segment: LocalSegment, copy: Copy): string {
  if (segment.hoursWorked) {
    return `${Number(segment.hoursWorked).toFixed(1)} ${copy.hrs} ${copy.serverSuffix}`
  }
  const end = segment.endedAtISO ? new Date(segment.endedAtISO).getTime() : Date.now()
  const hours = (end - new Date(segment.startedAtISO).getTime()) / (60 * 60 * 1000)
  return `${hours.toFixed(1)} ${copy.hrs}`
}

const styles = StyleSheet.create({
  bigButton: {
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center'
  },
  start: {
    backgroundColor: colors.gold
  },
  stop: {
    backgroundColor: colors.danger
  },
  pressed: {
    opacity: 0.85
  },
  bigButtonLabel: {
    color: colors.textInverse,
    fontSize: fontSize.h1,
    fontWeight: '700'
  },
  bigButtonHint: {
    color: colors.textInverse,
    fontSize: fontSize.body,
    marginTop: spacing.xs,
    opacity: 0.9
  },
  bigButtonLabelDark: {
    color: colors.earth900,
    fontSize: fontSize.h1,
    fontWeight: '700'
  },
  bigButtonHintDark: {
    color: colors.earth900,
    fontSize: fontSize.body,
    marginTop: spacing.xs,
    opacity: 0.85
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  summaryCard: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: fontSize.body
  },
  summaryValue: {
    color: colors.text,
    fontSize: fontSize.h2,
    fontWeight: '700',
    marginTop: spacing.xs
  },
  segment: {
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  segmentPrimary: {
    color: colors.text,
    fontSize: fontSize.lead,
    fontWeight: '600'
  },
  segmentSecondary: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: spacing.xs
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md
  },
  muted: {
    color: colors.textMuted,
    fontSize: fontSize.body
  },
  missing: {
    color: colors.warn,
    fontSize: fontSize.caption,
    fontWeight: '700',
    marginBottom: spacing.sm
  },
  successText: {
    color: colors.success,
    fontSize: fontSize.body,
    marginTop: spacing.sm,
    fontWeight: '600'
  },
  warnText: {
    color: colors.warn,
    fontSize: fontSize.body,
    marginTop: spacing.sm,
    fontWeight: '600'
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.body,
    marginTop: spacing.sm
  }
})
