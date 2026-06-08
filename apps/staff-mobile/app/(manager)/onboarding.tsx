/**
 * Manager onboarding review queue — HR chain L-A (issue #193).
 *
 * Lists candidates who have activated their invitation (status='active'
 * in workforce_invitations + workforce_status='pending' on users) and
 * lets the manager approve / reject each. Backend:
 *   GET  /api/v1/workforce/openings/candidates?status=pending
 *   POST /api/v1/workforce/openings/:id/candidates/:userId/review
 *
 * Locale is resolved from the signed-in user (`useI18n` → `useAuth`), so
 * the queue renders strictly single-language per the active toggle — no
 * hardcoded `lang`, no EN/SW mixing.
 */

import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { RoleGuard } from '../../src/components/RoleGuard'
import { Button } from '../../src/forms/Button'
import { request } from '../../src/api/client'
import { API_BASE_URL } from '../../src/api/config'
import { ApiError } from '../../src/api/errors'
import { useI18n } from '../../src/i18n/useI18n'
import type { Lang } from '../../src/auth/types'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'M-ONB'

const QUEUE_PATH = '/api/v1/workforce/openings/candidates'

interface Candidate {
  readonly id: string
  readonly userId: string
  readonly displayName: string
  readonly openingId: string
  readonly openingTitle: string
}

interface QueueResponse {
  readonly success: boolean
  readonly data?: ReadonlyArray<Candidate>
  readonly error?: { readonly code: string; readonly message: string }
}

interface ReviewResponse {
  readonly success: boolean
  readonly error?: { readonly code: string; readonly message: string }
}

type Copy = {
  readonly title: string
  readonly subtitle: string
  readonly queueTitle: string
  readonly empty: string
  readonly loadError: string
  readonly approve: string
  readonly reject: string
  readonly actionError: string
}

const STRINGS: Record<Lang, Copy> = {
  en: {
    title: 'New candidates',
    subtitle: 'Approve or reject candidates so they can join shifts.',
    queueTitle: 'Approval queue',
    empty: 'No candidates waiting right now.',
    loadError: 'Could not load the queue. Pull to retry.',
    approve: 'Approve',
    reject: 'Reject',
    actionError: 'Could not save your decision. Try again.',
  },
  sw: {
    title: 'Wagombea wapya',
    subtitle: 'Wakubali au wakatae wagombea ili wapate hisa za kazi.',
    queueTitle: 'Foleni ya idhini',
    empty: 'Hakuna wagombea kwa sasa.',
    loadError: 'Imeshindwa kupakia foleni. Vuta ili kujaribu tena.',
    approve: 'Kubali',
    reject: 'Kataa',
    actionError: 'Imeshindwa kuhifadhi uamuzi. Jaribu tena.',
  },
}

export default function OnboardingQueueScreen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <QueueView />
      </ScreenShell>
    </RoleGuard>
  )
}

function QueueView(): JSX.Element {
  const { lang } = useI18n()
  const copy = STRINGS[lang]
  const [candidates, setCandidates] = useState<ReadonlyArray<Candidate>>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<boolean>(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<boolean>(false)

  const loadQueue = useCallback(async (): Promise<void> => {
    setLoading(true)
    setLoadError(false)
    try {
      const resp = await request<QueueResponse>(`${API_BASE_URL}${QUEUE_PATH}`, {
        method: 'GET',
        query: { status: 'pending' },
      })
      setCandidates(resp.success ? resp.data ?? [] : [])
      if (!resp.success) setLoadError(true)
    } catch (error) {
      // A 404 means the queue endpoint is not wired yet — render the
      // empty state rather than an error so the screen stays usable.
      if (error instanceof ApiError && error.status === 404) {
        setCandidates([])
      } else {
        setLoadError(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  const review = useCallback(
    async (candidate: Candidate, decision: 'approve' | 'reject'): Promise<void> => {
      setPendingId(candidate.id)
      setActionError(false)
      const path = `${API_BASE_URL}/api/v1/workforce/openings/${encodeURIComponent(
        candidate.openingId,
      )}/candidates/${encodeURIComponent(candidate.userId)}/review`
      try {
        const resp = await request<ReviewResponse>(path, {
          method: 'POST',
          body: { decision },
        })
        if (!resp.success) {
          setActionError(true)
          return
        }
        // Drop the reviewed candidate from the queue (immutable update).
        setCandidates((prev) => prev.filter((c) => c.id !== candidate.id))
      } catch {
        setActionError(true)
      } finally {
        setPendingId(null)
      }
    },
    [],
  )

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.subtitle}>{copy.subtitle}</Text>

      <Section title={copy.queueTitle}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : loadError ? (
          <Text style={styles.error}>{copy.loadError}</Text>
        ) : candidates.length === 0 ? (
          <Text style={styles.empty}>{copy.empty}</Text>
        ) : (
          candidates.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{c.displayName}</Text>
                <Text style={styles.cardSubtitle}>{c.openingTitle}</Text>
              </View>
              <View style={styles.actions}>
                <Button
                  label={copy.reject}
                  onPress={() => void review(c, 'reject')}
                  variant="ghost"
                  disabled={pendingId !== null}
                  loading={pendingId === c.id}
                />
                <Button
                  label={copy.approve}
                  onPress={() => void review(c, 'approve')}
                  disabled={pendingId !== null}
                  loading={pendingId === c.id}
                />
              </View>
            </View>
          ))
        )}
        {actionError ? <Text style={styles.error}>{copy.actionError}</Text> : null}
      </Section>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.text, fontSize: fontSize.h2, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.body },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.body,
    paddingVertical: spacing.sm,
  },
  loadingRow: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.earth700,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardHeader: { gap: spacing.xs },
  cardTitle: { color: colors.text, fontSize: fontSize.lead, fontWeight: '600' },
  cardSubtitle: { color: colors.textMuted, fontSize: fontSize.body },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
})
