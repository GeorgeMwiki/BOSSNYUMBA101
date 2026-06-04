/**
 * Commercial chain L4 — manager task-queue.
 *
 * Lists the tenant's open maintenance_tasks (work-order) rows. Each row is
 * tappable and deep-links to `/(manager)/tasks/[id]/assign` for the
 * assign-worker flow. Application-fulfilment rows are highlighted
 * (`kind === 'application_fulfil'`) so the manager can see the applicant
 * pipeline at a glance.
 *
 * Bilingual sw/en throughout.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { ScreenShell } from '../../../src/components/ScreenShell'
import { Section } from '../../../src/components/Section'
import { useManagerOpenTasks } from '../../../src/manager/useManagerTasks'
import { useI18n } from '../../../src/i18n/useI18n'
import { colors } from '../../../src/theme/colors'
import { fontSize, radius, spacing } from '../../../src/theme/spacing'

const SCREEN_ID = 'M-M-01'

export default function ManagerTasksScreen(): JSX.Element {
  const tasksQuery = useManagerOpenTasks()
  const { lang } = useI18n()
  const isSw = lang === 'sw'

  const tasks = tasksQuery.data ?? []
  const applicationTasks = tasks.filter((t) => t.kind === 'application_fulfil')
  const standardTasks = tasks.filter((t) => t.kind !== 'application_fulfil')

  return (
    <ScreenShell screenId={SCREEN_ID}>
      <Section
        title={isSw ? 'Maombi ya wapangaji' : 'Applicant requests'}
        hint={
          isSw
            ? 'Kazi zinazotokana na maombi ya wapangaji — zinapaswa kupewa wafanyakazi.'
            : 'Tasks dispatched from applicant requests — assign these to workers first.'
        }
      >
        {tasksQuery.isPending ? (
          <Text style={styles.empty}>
            {isSw ? 'Inapakia kazi…' : 'Loading tasks…'}
          </Text>
        ) : tasksQuery.isError ? (
          <Text style={styles.error}>
            {isSw
              ? 'Imeshindwa kupakia kazi.'
              : 'Failed to load tasks.'}
          </Text>
        ) : applicationTasks.length === 0 ? (
          <Text style={styles.empty}>
            {isSw
              ? 'Hakuna maombi ya wapangaji kwa sasa.'
              : 'No applicant requests right now.'}
          </Text>
        ) : (
          <View style={styles.list}>
            {applicationTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isSw={isSw}
                accent={colors.gold}
              />
            ))}
          </View>
        )}
      </Section>

      <Section
        title={isSw ? 'Kazi za kawaida' : 'Standard tasks'}
        hint={
          isSw
            ? 'Kazi za kawaida zinazohitaji msimamizi kupanga.'
            : 'Standard ops tasks needing dispatch.'
        }
      >
        {standardTasks.length === 0 ? (
          <Text style={styles.empty}>
            {isSw
              ? 'Hakuna kazi za kawaida zinazosubiri.'
              : 'No standard tasks awaiting assignment.'}
          </Text>
        ) : (
          <View style={styles.list}>
            {standardTasks.map((task) => (
              <TaskCard key={task.id} task={task} isSw={isSw} />
            ))}
          </View>
        )}
      </Section>
    </ScreenShell>
  )
}

interface TaskCardProps {
  readonly task: ReturnType<typeof useManagerOpenTasks>['data'] extends
    | ReadonlyArray<infer T>
    | undefined
    ? T
    : never
  readonly isSw: boolean
  readonly accent?: string
}

function TaskCard({ task, isSw, accent }: TaskCardProps): JSX.Element {
  const title = isSw ? task.titleSw : task.titleEn ?? task.titleSw
  return (
    <Link href={`/(manager)/tasks/${task.id}/assign`} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          accent ? { borderLeftColor: accent, borderLeftWidth: 4 } : null,
          pressed ? styles.cardPressed : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isSw ? `Panga kazi: ${title}` : `Assign task: ${title}`
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.priorityChip}>
            <Text style={styles.priorityChipText}>
              {task.priority.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardMetaText}>
            {isSw ? 'Hali:' : 'Status:'} {task.status}
          </Text>
          {task.assignedToUserId ? (
            <Text style={styles.cardMetaText}>
              {isSw ? 'Mfanyakazi:' : 'Worker:'}{' '}
              {task.assignedToUserId.slice(0, 8)}…
            </Text>
          ) : (
            <Text style={styles.cardMetaText}>
              {isSw ? 'Haijapangwa' : 'Unassigned'}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.earth100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardPressed: {
    backgroundColor: colors.earth300,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  cardMeta: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardMetaText: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
  },
  priorityChip: {
    backgroundColor: colors.earth700,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityChipText: {
    color: colors.goldDark,
    fontSize: fontSize.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    fontStyle: 'italic',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.body,
  },
})
