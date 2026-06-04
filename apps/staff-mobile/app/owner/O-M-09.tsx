import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { RoleGuard } from '../../src/components/RoleGuard'
import { useI18n } from '../../src/i18n/useI18n'
import { groupByBucket, useLeases, useRenewLease } from '../../src/owner/useLicences'
import type { Lease, LeaseBucket } from '../../src/owner/types'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'O-M-09'
const TOAST_AUTO_DISMISS_MS = 4_000

export default function Screen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID} scroll={false}>
        <LeaseCalendarView />
      </ScreenShell>
    </RoleGuard>
  )
}

type RenewStatus =
  | { kind: 'idle' }
  | { kind: 'pending'; leaseId: string }
  | { kind: 'success'; leaseId: string }
  | { kind: 'error'; leaseId: string; message: string }

function LeaseCalendarView(): JSX.Element {
  const { t } = useI18n()
  const query = useLeases()
  const renewal = useRenewLease()
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [status, setStatus] = useState<RenewStatus>({ kind: 'idle' })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current)
      }
    }
  }, [])

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    try {
      await query.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [query])

  const onRenew = useCallback(
    (lease: Lease): void => {
      setStatus({ kind: 'pending', leaseId: lease.id })
      renewal.mutate(lease.id, {
        onSuccess: () => {
          setStatus({ kind: 'success', leaseId: lease.id })
          if (toastTimer.current) {
            clearTimeout(toastTimer.current)
          }
          toastTimer.current = setTimeout(() => {
            setStatus({ kind: 'idle' })
          }, TOAST_AUTO_DISMISS_MS)
        },
        onError: (error: Error) => {
          setStatus({
            kind: 'error',
            leaseId: lease.id,
            message: error.message
          })
        }
      })
    },
    [renewal]
  )

  if (query.isPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} />
        <Text style={styles.loadingText}>{t.licenceCalendar.loading}</Text>
      </View>
    )
  }

  if (query.isError) {
    return (
      <Section title={t.common.errorGeneric}>
        <Text style={styles.errorText}>{t.licenceCalendar.loading}</Text>
      </Section>
    )
  }

  const buckets = groupByBucket(query.data.leases)

  return (
    <View style={styles.container}>
      {status.kind === 'success' ? (
        <View
          accessibilityRole="alert"
          accessibilityLabel={`${t.licenceCalendar.renewSuccessSw}. ${t.licenceCalendar.renewSuccessEn}.`}
          style={styles.toastSuccess}
        >
          <Text style={styles.toastTitle}>{t.licenceCalendar.renewSuccessSw}</Text>
          <Text style={styles.toastSubtitle}>{t.licenceCalendar.renewSuccessEn}</Text>
        </View>
      ) : null}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.gold}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        <BucketSection
          title={t.licenceCalendar.t7}
          bucket="t7"
          leases={buckets.t7}
          status={status}
          strings={t.licenceCalendar}
          onRenew={onRenew}
        />
        <BucketSection
          title={t.licenceCalendar.t30}
          bucket="t30"
          leases={buckets.t30}
          status={status}
          strings={t.licenceCalendar}
          onRenew={onRenew}
        />
        <BucketSection
          title={t.licenceCalendar.t90}
          bucket="t90"
          leases={buckets.t90}
          status={status}
          strings={t.licenceCalendar}
          onRenew={onRenew}
        />
      </ScrollView>
    </View>
  )
}

interface LeaseCalendarStrings {
  empty: string
  renewAction: string
  renewActionEn: string
  daysLeft: string
  mineralLabel: string
  renewPending: string
  renewFailed: string
}

interface BucketSectionProps {
  title: string
  bucket: LeaseBucket
  leases: ReadonlyArray<Lease>
  status: RenewStatus
  strings: LeaseCalendarStrings
  onRenew: (lease: Lease) => void
}

function BucketSection({
  title,
  bucket,
  leases,
  status,
  strings,
  onRenew
}: BucketSectionProps): JSX.Element {
  return (
    <Section title={title}>
      {leases.length === 0 ? (
        <Text style={styles.empty}>{strings.empty}</Text>
      ) : (
        leases.map((lease) => (
          <LeaseRow
            key={lease.id}
            lease={lease}
            bucket={bucket}
            status={status}
            strings={strings}
            onRenew={onRenew}
          />
        ))
      )}
    </Section>
  )
}

interface LeaseRowProps {
  lease: Lease
  bucket: LeaseBucket
  status: RenewStatus
  strings: LeaseCalendarStrings
  onRenew: (lease: Lease) => void
}

function LeaseRow({
  lease,
  bucket,
  status,
  strings,
  onRenew
}: LeaseRowProps): JSX.Element {
  const isPending = status.kind === 'pending' && status.leaseId === lease.id
  const isError = status.kind === 'error' && status.leaseId === lease.id
  const renewLabel = `${strings.renewAction} / ${strings.renewActionEn}`
  return (
    <View style={[styles.card, BUCKET_STYLES[bucket]]}>
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardTitle}>{lease.leaseRef}</Text>
          <Text style={styles.cardSite}>{lease.propertyName}</Text>
          {lease.unitLabel ? (
            <Text style={styles.cardMineral}>
              {strings.mineralLabel}: {lease.unitLabel}
            </Text>
          ) : null}
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardDays}>{lease.daysLeft}</Text>
          <Text style={styles.cardDaysLabel}>{strings.daysLeft}</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={renewLabel}
        accessibilityState={{ disabled: isPending, busy: isPending }}
        disabled={isPending}
        onPress={() => onRenew(lease)}
        style={({ pressed }) => [
          styles.renewButton,
          isPending ? styles.renewButtonPending : null,
          pressed && !isPending ? styles.renewButtonPressed : null
        ]}
      >
        {isPending ? (
          <View style={styles.renewButtonInner}>
            <ActivityIndicator color={colors.textInverse} size="small" />
            <Text style={styles.renewButtonText}>{strings.renewPending}</Text>
          </View>
        ) : (
          <View style={styles.renewButtonInner}>
            <Text style={styles.renewButtonText}>{strings.renewAction}</Text>
            <Text style={styles.renewButtonSubtext}>{strings.renewActionEn}</Text>
          </View>
        )}
      </Pressable>
      {isError ? (
        <Text accessibilityRole="alert" style={styles.rowError}>
          {strings.renewFailed}
        </Text>
      ) : null}
    </View>
  )
}

const BUCKET_STYLES: Readonly<
  Record<LeaseBucket, { borderLeftColor: string; backgroundColor: string }>
> = {
  t7: { borderLeftColor: colors.danger, backgroundColor: colors.surfaceAlt },
  t30: { borderLeftColor: colors.warn, backgroundColor: colors.surfaceAlt },
  t90: { borderLeftColor: colors.goldLight, backgroundColor: colors.surfaceAlt },
  expired: { borderLeftColor: colors.earth900, backgroundColor: colors.surfaceAlt }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: spacing.xl
  },
  loading: {
    alignItems: 'center',
    padding: spacing.xl
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: fontSize.body
  },
  errorText: {
    color: colors.danger
  },
  toastSuccess: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.md
  },
  toastTitle: {
    color: colors.textInverse,
    fontSize: fontSize.lead,
    fontWeight: '700'
  },
  toastSubtitle: {
    color: colors.textInverse,
    fontSize: fontSize.body,
    marginTop: spacing.xs
  },
  card: {
    borderLeftWidth: 6,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  cardLeft: {
    flexShrink: 1,
    paddingRight: spacing.sm
  },
  cardTitle: {
    color: colors.earth900,
    fontSize: fontSize.h3,
    fontWeight: '700'
  },
  cardSite: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    marginTop: spacing.xs
  },
  cardMineral: {
    color: colors.earth700,
    fontSize: fontSize.caption,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5
  },
  cardRight: {
    alignItems: 'flex-end'
  },
  cardDays: {
    color: colors.earth900,
    fontSize: 28,
    fontWeight: '800'
  },
  cardDaysLabel: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    textTransform: 'uppercase',
    fontWeight: '700'
  },
  renewButton: {
    marginTop: spacing.md,
    backgroundColor: colors.earth900,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center'
  },
  renewButtonPending: {
    backgroundColor: colors.earth700
  },
  renewButtonPressed: {
    opacity: 0.85
  },
  renewButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  renewButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.lead,
    fontWeight: '700'
  },
  renewButtonSubtext: {
    color: colors.textInverse,
    fontSize: fontSize.caption,
    opacity: 0.85
  },
  rowError: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontSize: fontSize.caption,
    fontWeight: '600'
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.body
  }
})
