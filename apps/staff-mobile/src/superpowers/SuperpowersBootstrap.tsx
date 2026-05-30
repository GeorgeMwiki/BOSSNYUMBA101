/**
 * SuperpowersBootstrap — mounts the three always-on surfaces (SearchFab,
 * undo toast, bulk action chip) for staff-mobile.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { colors } from '../theme/colors'
import { radius, spacing, fontSize } from '../theme/spacing'
import { undoToastBus, bulkActionBus, type UndoToastEvent } from './bus'
import { undoJournalIds } from './undo'
import { navigateToTarget, DEFAULT_STAFF_TARGETS, type NavigateTarget } from './navigate'
import { runUniversalSearch, getRecentSearches, rememberRecentSearch, type SearchResult } from './search'
import { getLiveBulkSelection, runStaffBulkAction } from './bulk'

interface UndoState {
  readonly toast: UndoToastEvent
  readonly secondsLeft: number
}

function UndoToastMount(): JSX.Element | null {
  const [state, setState] = useState<UndoState | null>(null)
  const [undone, setUndone] = useState(false)

  useEffect(() => {
    return undoToastBus.subscribe((toast) => {
      setUndone(false)
      setState({ toast, secondsLeft: toast.windowSeconds ?? 8 })
    })
  }, [])

  useEffect(() => {
    if (!state || undone || state.secondsLeft <= 0) return
    const t = setTimeout(() => {
      setState((prev) => (prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : prev))
    }, 1000)
    return () => clearTimeout(t)
  }, [state, undone])

  const onUndo = useCallback(async () => {
    if (!state || undone) return
    const ok = await undoJournalIds(state.toast.journalIds)
    setUndone(ok)
    if (ok) {
      setTimeout(() => setState(null), 1500)
    }
  }, [state, undone])

  if (!state || state.secondsLeft <= 0) return null

  return (
    <View style={styles.undoToastWrap} pointerEvents="box-none">
      <View style={styles.undoToast}>
        <Text style={styles.undoLabel} numberOfLines={1}>
          {undone ? 'Undone' : state.toast.label}
        </Text>
        {!undone && state.toast.journalIds.length > 0 ? (
          <TouchableOpacity
            onPress={() => void onUndo()}
            style={styles.undoButton}
            accessibilityRole="button"
            accessibilityLabel="Undo last action"
            hitSlop={8}
          >
            <Text style={styles.undoButtonText}>Undo ({state.secondsLeft})</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

function BulkActionMount(): JSX.Element | null {
  const [tick, setTick] = useState(0)
  useEffect(() => bulkActionBus.subscribe(() => setTick((n) => n + 1)), [])
  const sel = getLiveBulkSelection()
  if (!sel || sel.ids.length === 0) return null
  return (
    <View key={tick} style={styles.bulkChipWrap} pointerEvents="box-none">
      <View style={styles.bulkChip}>
        <Text style={styles.bulkChipText}>{sel.ids.length} selected</Text>
        <TouchableOpacity
          onPress={() => {
            void runStaffBulkAction(sel.entityType, sel.ids, 'bulk_close', `Closed ${sel.ids.length}`)
          }}
          style={styles.bulkChipAction}
          accessibilityRole="button"
          accessibilityLabel="Close selected tickets"
          hitSlop={8}
        >
          <Text style={styles.bulkChipActionText}>Close</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            void runStaffBulkAction(sel.entityType, sel.ids, 'bulk_dispatch', `Dispatched ${sel.ids.length}`)
          }}
          style={styles.bulkChipAction}
          accessibilityRole="button"
          accessibilityLabel="Dispatch selected"
          hitSlop={8}
        >
          <Text style={styles.bulkChipActionText}>Dispatch</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function SearchFab(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ReadonlyArray<SearchResult>>([])

  useEffect(() => {
    if (!open) return
    const handle = setTimeout(() => {
      if (query.trim().length === 0) {
        setResults(getRecentSearches())
        return
      }
      void runUniversalSearch(query).then(setResults)
    }, 200)
    return () => clearTimeout(handle)
  }, [open, query])

  const onPickTarget = useCallback((t: NavigateTarget) => {
    rememberRecentSearch(t)
    setOpen(false)
    setQuery('')
    navigateToTarget(t)
  }, [])

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Open universal search"
        hitSlop={6}
      >
        <Text style={styles.fabText}>?</Text>
      </TouchableOpacity>
      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              accessibilityLabel="Universal search input"
            />
            <View style={styles.resultsList}>
              {(results.length > 0 ? results : DEFAULT_STAFF_TARGETS).map((r) => (
                <TouchableOpacity
                  key={`${r.route}-${r.label}`}
                  onPress={() => onPickTarget(r)}
                  style={styles.resultRow}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${r.label}`}
                >
                  <Text style={styles.resultLabel}>{r.label}</Text>
                  <Text style={styles.resultRoute}>{r.route}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

export function SuperpowersBootstrap(): JSX.Element {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <BulkActionMount />
      <UndoToastMount />
      <SearchFab />
    </View>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xxl + spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.earth900,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  fabText: {
    color: colors.earth800,
    fontSize: fontSize.h2,
    fontWeight: '700'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: spacing.xxl * 2,
    alignItems: 'center'
  },
  modalCard: {
    width: '92%',
    backgroundColor: colors.earth700,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border
  },
  searchInput: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.earth800,
    fontSize: fontSize.lead
  },
  resultsList: {
    gap: spacing.xs
  },
  resultRow: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.earth800
  },
  resultLabel: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600'
  },
  resultRoute: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: 2
  },
  undoToastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.xxl + 80,
    alignItems: 'center'
  },
  undoToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.earth700,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: spacing.md,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxWidth: '92%'
  },
  undoLabel: {
    color: colors.text,
    fontSize: fontSize.body,
    flexShrink: 1
  },
  undoButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    minHeight: 32
  },
  undoButtonText: {
    color: colors.earth800,
    fontWeight: '700',
    fontSize: fontSize.body
  },
  bulkChipWrap: {
    position: 'absolute',
    top: spacing.xxl + spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  bulkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.earth700,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border
  },
  bulkChipText: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600'
  },
  bulkChipAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    minHeight: 32
  },
  bulkChipActionText: {
    color: colors.earth800,
    fontWeight: '700',
    fontSize: fontSize.body
  }
})
