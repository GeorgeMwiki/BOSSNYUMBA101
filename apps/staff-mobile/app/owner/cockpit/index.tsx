/**
 * Owner-mobile cockpit hub — Roadmap R7.
 *
 * Single mobile-friendly surface that aggregates the owner-web cockpit
 * panels (brief, recent decisions, opportunities, risks, reminders)
 * into a swipe-and-scroll layout. Re-uses the /v1/owner/cockpit/hub
 * endpoint via `useCockpitHub`.
 *
 * Tap targets follow Material 3's 48dp minimum so the surface is usable
 * with gloves on (outdoor field-staff ergonomic constraint).
 */

import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Redirect } from 'expo-router'
import { ScreenShell } from '../../../src/components/ScreenShell'
import { Section } from '../../../src/components/Section'
import { useAuth } from '../../../src/auth/useAuth'
import { useI18n } from '../../../src/i18n/useI18n'
import type { Lang } from '../../../src/auth/types'
import { colors } from '../../../src/theme/colors'
import { fontSize, radius, spacing } from '../../../src/theme/spacing'
import {
  useCockpitHub,
  isEmptyCockpit,
  type CockpitDecisionSummary,
  type CockpitOpportunity,
  type CockpitRisk,
  type CockpitReminder,
} from '../../../src/owner/cockpit/useCockpitHub'

/**
 * Single-locale copy for the cockpit hub. Every string resolves to exactly
 * ONE language per the active locale — no stacked sw/en renders anywhere on
 * this surface (absolute language-toggle rule). English is the default.
 */
const COCKPIT_COPY = Object.freeze({
  ownerOnly: Object.freeze({ en: 'Cockpit hub is owner-only', sw: 'Cockpit ni kwa mmiliki tu' }),
  loading: Object.freeze({ en: 'Loading cockpit…', sw: 'Inapakia cockpit…' }),
  loadError: Object.freeze({ en: 'Cockpit failed to load', sw: 'Cockpit imeshindwa kupakia' }),
  emptyTitle: Object.freeze({
    en: 'No fresh cockpit data yet — pull down to refresh.',
    sw: 'Hakuna data mpya bado — vuta chini kuburudisha.',
  }),
  brief: Object.freeze({ en: 'Brief', sw: 'Muhtasari' }),
  decisions: Object.freeze({ en: 'Recent decisions', sw: 'Maamuzi ya hivi karibuni' }),
  noDecisions: Object.freeze({ en: 'No pending decisions', sw: 'Hakuna maamuzi yaliyosubiri' }),
  opportunities: Object.freeze({ en: 'Opportunities', sw: 'Fursa' }),
  noOpportunities: Object.freeze({ en: 'No fresh opportunities', sw: 'Hakuna fursa mpya' }),
  risks: Object.freeze({ en: 'Risks', sw: 'Hatari' }),
  noRisks: Object.freeze({ en: 'No active risks', sw: 'Hakuna hatari za sasa' }),
  reminders: Object.freeze({ en: 'Reminders', sw: 'Ukumbusho' }),
  noReminders: Object.freeze({ en: 'No reminders', sw: 'Hakuna ukumbusho' }),
  raised: Object.freeze({ en: 'Raised', sw: 'Iliibuliwa' }),
  due: Object.freeze({ en: 'Due', sw: 'Inaisha' }),
}) as Readonly<Record<string, Readonly<Record<Lang, string>>>>

function copy(key: keyof typeof COCKPIT_COPY | string, lang: Lang): string {
  return COCKPIT_COPY[key]?.[lang] ?? ''
}

// Screen ID is intentionally NOT registered in
// `src/roles/access.ts` — the cockpit hub is reachable only from
// inside the owner branch (O-M-01 → "Open cockpit hub" link) so the
// owner-role gate flows from the parent screen. Adding a registry
// entry here would step on the mobile zone owner's file; we inline a
// lightweight role check instead.
const SCREEN_ID = 'O-M-01'

export default function CockpitHubScreen(): JSX.Element {
  const { user, ready } = useAuth()
  const { lang } = useI18n()
  if (!ready) return <View style={{ flex: 1 }} />
  if (!user) return <Redirect href="/onboarding/role" />
  if (user.role !== 'owner') {
    return (
      <View style={styles.loading}>
        <Text style={styles.error}>{copy('ownerOnly', lang)}</Text>
      </View>
    )
  }
  return (
    <ScreenShell screenId={SCREEN_ID} scroll={false}>
      <CockpitHubView />
    </ScreenShell>
  )
}

function CockpitHubView(): JSX.Element {
  const query = useCockpitHub()
  const { lang } = useI18n()
  const [refreshing, setRefreshing] = useState<boolean>(false)

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    try {
      await query.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [query])

  if (query.isPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} />
        <Text style={styles.muted}>{copy('loading', lang)}</Text>
      </View>
    )
  }
  if (query.isError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.error}>{copy('loadError', lang)}</Text>
      </View>
    )
  }
  const data = query.data
  const empty = isEmptyCockpit(data)
  const briefHeadline = lang === 'sw' ? data.brief.headlineSw : data.brief.headlineEn
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={colors.gold}
        />
      }
    >
      {empty ? (
        <View style={styles.bannerEmpty}>
          <Text style={styles.bannerText}>{copy('emptyTitle', lang)}</Text>
        </View>
      ) : null}

      <Section title={copy('brief', lang)}>
        <View style={styles.briefCard}>
          <Text style={styles.briefHeadline}>{briefHeadline}</Text>
        </View>
      </Section>

      <Section title={`${copy('decisions', lang)} (${data.decisions.length})`}>
        {data.decisions.length === 0 ? (
          <Text style={styles.muted}>{copy('noDecisions', lang)}</Text>
        ) : (
          data.decisions.slice(0, 5).map((decision) => (
            <DecisionRow key={decision.id} decision={decision} lang={lang} />
          ))
        )}
      </Section>

      <Section title={`${copy('opportunities', lang)} (${data.opportunities.length})`}>
        {data.opportunities.length === 0 ? (
          <Text style={styles.muted}>{copy('noOpportunities', lang)}</Text>
        ) : (
          data.opportunities.slice(0, 5).map((opportunity) => (
            <OpportunityRow
              key={opportunity.id}
              opportunity={opportunity}
            />
          ))
        )}
      </Section>

      <Section title={`${copy('risks', lang)} (${data.risks.length})`}>
        {data.risks.length === 0 ? (
          <Text style={styles.muted}>{copy('noRisks', lang)}</Text>
        ) : (
          data.risks.slice(0, 5).map((risk) => (
            <RiskRow key={risk.id} risk={risk} />
          ))
        )}
      </Section>

      <Section title={`${copy('reminders', lang)} (${data.reminders.length})`}>
        {data.reminders.length === 0 ? (
          <Text style={styles.muted}>{copy('noReminders', lang)}</Text>
        ) : (
          data.reminders.slice(0, 5).map((reminder) => (
            <ReminderRow key={reminder.id} reminder={reminder} lang={lang} />
          ))
        )}
      </Section>
    </ScrollView>
  )
}

function DecisionRow({
  decision,
  lang,
}: {
  readonly decision: CockpitDecisionSummary
  readonly lang: Lang
}): JSX.Element {
  return (
    <Pressable style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowTitle}>{decision.summary}</Text>
        <Text style={styles.severity}>{decision.severity.toUpperCase()}</Text>
      </View>
      <Text style={styles.muted}>
        {copy('raised', lang)} {new Date(decision.raisedAt).toLocaleString()}
      </Text>
    </Pressable>
  )
}

function OpportunityRow({
  opportunity,
}: {
  readonly opportunity: CockpitOpportunity
}): JSX.Element {
  return (
    <Pressable style={styles.row}>
      <Text style={styles.rowTitle}>{opportunity.summary}</Text>
      <Text style={styles.muted}>
        ~TZS {Math.round(opportunity.expectedValueTzs).toLocaleString()} ·{' '}
        {opportunity.kind}
      </Text>
    </Pressable>
  )
}

function RiskRow({ risk }: { readonly risk: CockpitRisk }): JSX.Element {
  return (
    <Pressable style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowTitle}>{risk.summary}</Text>
        <Text style={styles.severity}>{risk.severity.toUpperCase()}</Text>
      </View>
      <Text style={styles.muted}>{risk.kind}</Text>
    </Pressable>
  )
}

function ReminderRow({
  reminder,
  lang,
}: {
  readonly reminder: CockpitReminder
  readonly lang: Lang
}): JSX.Element {
  return (
    <Pressable style={styles.row}>
      <Text style={styles.rowTitle}>{reminder.text}</Text>
      <Text style={styles.muted}>
        {copy('due', lang)} {new Date(reminder.dueAt).toLocaleString()}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  loading: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  muted: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    marginTop: spacing.xs,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.body,
  },
  bannerEmpty: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  bannerText: {
    color: colors.text,
    fontSize: fontSize.body,
  },
  briefCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  briefHeadline: {
    color: colors.text,
    fontSize: fontSize.h3,
    fontWeight: '600',
  },
  row: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '500',
    flex: 1,
  },
  severity: {
    color: colors.gold,
    fontSize: fontSize.body,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
})
