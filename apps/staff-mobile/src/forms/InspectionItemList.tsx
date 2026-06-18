import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Field } from './Field'
import { Button } from './Button'
import { Dropdown } from './Dropdown'
import { colors } from '../theme/colors'
import { fontSize, radius, spacing } from '../theme/spacing'
import type { InspectionItem, InspectionCondition } from './schemas/inspection'

export interface ConditionOption {
  value: InspectionCondition
  label: string
}

export interface InspectionItemListProps {
  items: ReadonlyArray<InspectionItem>
  draft: DraftItem
  onChangeDraft: (next: DraftItem) => void
  onAdd: () => void
  onRemove: (id: string) => void
  addLabel: string
  removeLabel: string
  areaLabel: string
  conditionLabel: string
  notesLabel: string
  emptyLabel: string
  conditionOptions: ReadonlyArray<ConditionOption>
}

export interface DraftItem {
  area: string
  condition: InspectionCondition
  notes: string
}

export const EMPTY_ITEM: DraftItem = { area: '', condition: 'good', notes: '' }

function conditionLabelFor(
  condition: InspectionCondition,
  options: ReadonlyArray<ConditionOption>
): string {
  return options.find((option) => option.value === condition)?.label ?? condition
}

export function InspectionItemList({
  items,
  draft,
  onChangeDraft,
  onAdd,
  onRemove,
  addLabel,
  removeLabel,
  areaLabel,
  conditionLabel,
  notesLabel,
  emptyLabel,
  conditionOptions
}: InspectionItemListProps): JSX.Element {
  const canAdd = draft.area.trim().length > 0
  return (
    <View>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyLabel}>{emptyLabel}</Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowArea}>{item.area}</Text>
              <Text style={styles.rowCondition}>
                {conditionLabelFor(item.condition, conditionOptions)}
                {item.notes ? ` · ${item.notes}` : ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={removeLabel}
              onPress={() => onRemove(item.id)}
              style={styles.remove}
            >
              <Text style={styles.removeLabel}>{removeLabel}</Text>
            </Pressable>
          </View>
        ))
      )}
      <View style={styles.draftBox}>
        <Field
          label={areaLabel}
          value={draft.area}
          onChangeText={(value) => onChangeDraft({ ...draft, area: value })}
        />
        <Dropdown<InspectionCondition>
          label={conditionLabel}
          value={draft.condition}
          onChange={(value) => onChangeDraft({ ...draft, condition: value })}
          options={conditionOptions}
        />
        <Field
          label={notesLabel}
          value={draft.notes}
          onChangeText={(value) => onChangeDraft({ ...draft, notes: value })}
        />
        <Button label={addLabel} variant="secondary" disabled={!canAdd} onPress={onAdd} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  empty: {
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    marginBottom: spacing.sm
  },
  emptyLabel: {
    color: colors.textMuted,
    fontSize: fontSize.body
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  rowInfo: {
    flex: 1
  },
  rowArea: {
    color: colors.earth900,
    fontSize: fontSize.lead,
    fontWeight: '700'
  },
  rowCondition: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    marginTop: spacing.xs
  },
  remove: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.danger
  },
  removeLabel: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: fontSize.caption
  },
  draftBox: {
    backgroundColor: colors.earth100,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm
  }
})
