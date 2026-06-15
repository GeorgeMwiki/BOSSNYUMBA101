/**
 * Tenant-mobile — L8 lease-activation screen.
 *
 * The screen loads GET /api/v1/marketplace/rfb/:id to resolve the ACCEPTED
 * landlord-response id; the CTA stays gated behind an honest "awaiting
 * acceptance" state until one exists, so a sign tap never posts a stand-in id
 * and 404s. On sign it POSTs /marketplace/rfb-responses/:responseId/
 * sign-delivery — the api-gateway derives a deterministic checksum (sha256 over
 * the ownership-history chain) server-side and runs the settlement orchestrator
 * end-to-end (math → LedgerService.post() → M-Pesa B2C payout). Result is shown
 * in a success banner with the gross/deduction/fee/net breakdown.
 *
 * Bilingual sw/en throughout.
 */

import { useCallback } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useTranslation } from '@/hooks/useTranslation'
import { Card } from '@/components/Card'
import { tokens } from '@/ui'
import { apiFetch } from '@/api/client'

interface SignDeliveryResponse {
  readonly success: boolean
  readonly data?: {
    readonly settlementId: string
    readonly status: string
    readonly grossTzs: number
    readonly deductionTzs: number
    readonly feeTzs: number
    readonly netTzs: number
    readonly ledgerTxnId: string | null
    readonly payoutProvider: string | null
    readonly idempotent: boolean
  }
  readonly error?: {
    readonly code?: string
    readonly message?: string | { sw?: string; en?: string }
  }
}

interface RfbDetailResponse {
  readonly success: boolean
  readonly data?: {
    readonly accepted_response_id: string | null
  }
}

/**
 * Load the rfb detail and resolve the ACCEPTED landlord-response id — the id the
 * settlement endpoint needs. Returns null when no response has been accepted yet
 * (the screen then shows an honest "awaiting acceptance" state instead of a CTA
 * that would 404).
 */
async function fetchAcceptedResponseId(rfbId: string): Promise<string | null> {
  const res = await apiFetch<RfbDetailResponse>(
    `/api/v1/marketplace/rfb/${encodeURIComponent(rfbId)}`,
  )
  if (!res.success || !res.data) {
    throw new Error('Failed to load request')
  }
  return res.data.accepted_response_id ?? null
}

async function signDelivery(
  responseId: string,
): Promise<NonNullable<SignDeliveryResponse['data']>> {
  // The checksum is derived server-side (deterministic sha256 over the
  // ownership-history chain) so the client sends no non-deterministic value.
  const res = await apiFetch<SignDeliveryResponse>(
    `/api/v1/marketplace/rfb-responses/${encodeURIComponent(responseId)}/sign-delivery`,
    { method: 'POST', body: {} },
  )
  if (!res.success || !res.data) {
    throw new Error('Sign delivery failed')
  }
  return res.data
}

function formatTzs(amount: number, isSw: boolean): string {
  const fmt = new Intl.NumberFormat(isSw ? 'sw-TZ' : 'en-US', {
    maximumFractionDigits: 0,
  })
  return `${fmt.format(amount)} TZS`
}

export default function SignDeliveryScreen(): JSX.Element {
  const params = useLocalSearchParams<{ id: string }>()
  const rfbId = String(params.id ?? '')
  const router = useRouter()
  const { lang } = useTranslation()
  const isSw = lang === 'sw'

  // Resolve the accepted-response id from the rfb detail. The CTA stays gated
  // behind an honest "awaiting acceptance" state until a landlord response is
  // accepted, so a sign tap never posts a stand-in id and 404s.
  const detail = useQuery({
    queryKey: ['rfb-accepted-response', rfbId],
    queryFn: () => fetchAcceptedResponseId(rfbId),
    enabled: rfbId.length > 0,
    staleTime: 15_000,
  })
  const responseId = detail.data ?? null

  const mutation = useMutation({
    mutationFn: (id: string) => signDelivery(id),
  })

  const onSubmit = useCallback(() => {
    if (!responseId) return
    mutation.mutate(responseId)
  }, [mutation, responseId])

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            {isSw ? 'Saini ya Mkataba' : 'Sign Lease'}
          </Text>
          <Text style={styles.title}>
            {isSw
              ? 'Thibitisha kuanza upangaji wako'
              : 'Confirm your tenancy'}
          </Text>
          <Text style={styles.subtitle}>
            {isSw
              ? 'Kusaini kutaanzisha malipo kwa mwenye nyumba moja kwa moja kupitia M-Pesa.'
              : 'Signing initiates payment to the landlord via M-Pesa instantly.'}
          </Text>
        </View>

        <Card>
          <Text style={styles.cardTitle}>
            {isSw ? 'Maelezo ya RFB' : 'RFB details'}
          </Text>
          <View style={styles.row}>
            <Text style={styles.label}>{isSw ? 'RFB ID' : 'RFB id'}</Text>
            <Text style={styles.value}>{rfbId.slice(0, 8)}…</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{isSw ? 'Hali' : 'Status'}</Text>
            <Text style={styles.value}>
              {detail.isPending
                ? isSw
                  ? 'Inapakia…'
                  : 'Loading…'
                : detail.isError
                  ? isSw
                    ? 'Imeshindwa kupakia'
                    : 'Failed to load'
                  : responseId
                    ? isSw
                      ? 'Jibu limekubaliwa'
                      : 'Response accepted'
                    : isSw
                      ? 'Inasubiri kukubaliwa'
                      : 'Awaiting acceptance'}
            </Text>
          </View>
        </Card>

        {/* Honest "awaiting acceptance" state — no accepted response, no CTA. */}
        {!detail.isPending && !detail.isError && !responseId && !mutation.isSuccess ? (
          <Card>
            <Text style={styles.muted}>
              {isSw
                ? 'Hakuna jibu lililokubaliwa bado. Utaweza kusaini mara mwenye nyumba atakapokubali ombi lako.'
                : "No accepted response yet. You'll be able to sign once a landlord's response is accepted."}
            </Text>
          </Card>
        ) : null}

        {mutation.isError ? (
          <Card>
            <Text style={styles.errorTitle}>
              {isSw ? 'Imeshindwa' : 'Failed'}
            </Text>
            <Text style={styles.errorBody}>
              {mutation.error instanceof Error
                ? mutation.error.message
                : isSw
                  ? 'Hitilafu isiyojulikana'
                  : 'Unknown error'}
            </Text>
          </Card>
        ) : null}

        {mutation.isSuccess && mutation.data ? (
          <Card>
            <Text style={styles.successTitle}>
              {isSw ? 'Imekamilika' : 'Settled'}
            </Text>
            <View style={styles.row}>
              <Text style={styles.label}>{isSw ? 'Jumla' : 'Gross'}</Text>
              <Text style={styles.value}>
                {formatTzs(mutation.data.grossTzs, isSw)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{isSw ? 'Makato' : 'Deduction'}</Text>
              <Text style={styles.value}>
                {formatTzs(mutation.data.deductionTzs, isSw)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{isSw ? 'Ada' : 'Platform fee'}</Text>
              <Text style={styles.value}>
                {formatTzs(mutation.data.feeTzs, isSw)}
              </Text>
            </View>
            <View style={[styles.row, styles.rowEmphasis]}>
              <Text style={styles.labelEmphasis}>
                {isSw ? 'Mwenye nyumba atapokea' : 'Landlord receives'}
              </Text>
              <Text style={styles.valueEmphasis}>
                {formatTzs(mutation.data.netTzs, isSw)}
              </Text>
            </View>
            {mutation.data.ledgerTxnId ? (
              <View style={styles.row}>
                <Text style={styles.label}>
                  {isSw ? 'Jarida' : 'Ledger txn'}
                </Text>
                <Text style={styles.valueMono}>
                  {mutation.data.ledgerTxnId.slice(0, 16)}…
                </Text>
              </View>
            ) : null}
            {mutation.data.payoutProvider ? (
              <View style={styles.row}>
                <Text style={styles.label}>{isSw ? 'Njia' : 'Provider'}</Text>
                <Text style={styles.value}>
                  {mutation.data.payoutProvider}
                </Text>
              </View>
            ) : null}
            {mutation.data.idempotent ? (
              <Text style={styles.muted}>
                {isSw
                  ? 'Imekamilika tayari (idempotent)'
                  : 'Already settled (idempotent)'}
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={!responseId || mutation.isPending || mutation.isSuccess}
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaPressed,
            (!responseId || mutation.isPending || mutation.isSuccess) &&
              styles.ctaDisabled,
          ]}
        >
          <Text style={styles.ctaText}>
            {mutation.isPending
              ? isSw
                ? 'Inashughulikia…'
                : 'Processing…'
              : mutation.isSuccess
                ? isSw
                  ? 'Imefanyika'
                  : 'Done'
                : isSw
                  ? 'Saini Mkataba'
                  : 'Sign Lease'}
          </Text>
        </Pressable>

        {mutation.isSuccess ? (
          <Pressable
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
          >
            <Text style={styles.secondaryText}>
              {isSw ? 'Angalia arifa' : 'View notifications'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.color.bgBase },
  scroll: { padding: tokens.space.lg, gap: tokens.space.md },
  header: { marginBottom: tokens.space.md },
  eyebrow: {
    ...tokens.type.bodySm,
    color: tokens.color.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    ...tokens.type.h2,
    color: tokens.color.textPrimary,
    marginTop: tokens.space.xs,
  },
  subtitle: {
    ...tokens.type.body,
    color: tokens.color.textMuted,
    marginTop: tokens.space.xs,
  },
  cardTitle: {
    ...tokens.type.bodyStrong,
    color: tokens.color.textPrimary,
    marginBottom: tokens.space.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.space.xs,
  },
  rowEmphasis: {
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    marginTop: tokens.space.sm,
    paddingTop: tokens.space.sm,
  },
  label: { ...tokens.type.body, color: tokens.color.textMuted },
  labelEmphasis: {
    ...tokens.type.bodyStrong,
    color: tokens.color.textPrimary,
  },
  value: { ...tokens.type.body, color: tokens.color.textPrimary },
  valueEmphasis: {
    ...tokens.type.bodyStrong,
    color: tokens.color.accent,
  },
  valueMono: {
    ...tokens.type.bodySm,
    color: tokens.color.textPrimary,
    fontFamily: 'Courier',
  },
  muted: {
    ...tokens.type.bodySm,
    color: tokens.color.textMuted,
    marginTop: tokens.space.sm,
    fontStyle: 'italic',
  },
  successTitle: {
    ...tokens.type.bodyStrong,
    color: tokens.color.accent,
    marginBottom: tokens.space.sm,
  },
  errorTitle: {
    ...tokens.type.bodyStrong,
    color: tokens.color.danger,
    marginBottom: tokens.space.sm,
  },
  errorBody: { ...tokens.type.body, color: tokens.color.danger },
  cta: {
    backgroundColor: tokens.color.accent,
    borderRadius: tokens.radius.xl,
    padding: tokens.space.lg,
    alignItems: 'center',
    marginTop: tokens.space.md,
  },
  ctaPressed: { opacity: 0.9 },
  ctaDisabled: { opacity: 0.5 },
  ctaText: {
    ...tokens.type.bodyStrong,
    color: tokens.color.bgBase,
  },
  secondary: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.xl,
    padding: tokens.space.md,
    alignItems: 'center',
  },
  secondaryPressed: { opacity: 0.8 },
  secondaryText: { ...tokens.type.body, color: tokens.color.textPrimary },
})
