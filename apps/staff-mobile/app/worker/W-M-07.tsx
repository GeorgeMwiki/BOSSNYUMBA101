import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { RoleGuard } from '../../src/components/RoleGuard'
import { Button } from '../../src/forms/Button'
import {
  InspectionItemList,
  EMPTY_ITEM,
  type DraftItem,
  type ConditionOption
} from '../../src/forms/InspectionItemList'
import { GpsCard } from '../../src/forms/GpsCard'
import { ConfirmationCard } from '../../src/forms/ConfirmationCard'
import { InspectionFields } from '../../src/forms/inspectionFields'
import { useI18n } from '../../src/i18n/useI18n'
import { useLocation } from '../../src/location/useLocation'
import { nearestFence } from '../../src/location/fence'
import { useOnlineStatus } from '../../src/offline/useOnlineStatus'
import { enqueueWrite } from '../../src/sync/queue'
import {
  inspectionFormSchema,
  generateInspectionId,
  type InspectionForm,
  type InspectionPayload,
  type InspectionItem
} from '../../src/forms/schemas/inspection'
import { spacing } from '../../src/theme/spacing'

const SCREEN_ID = 'W-M-07'

interface SubmittedRef {
  queueId: string
}

function newItemId(): string {
  // eslint-disable-next-line no-restricted-syntax -- React Native client-local id (no Web Crypto); uniqueness suffices, not security-sensitive
  return `i_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export default function Screen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <InspectionFormView />
      </ScreenShell>
    </RoleGuard>
  )
}

function InspectionFormView(): JSX.Element {
  const { t } = useI18n()
  const { online } = useOnlineStatus()
  const location = useLocation({ auto: true })
  const [items, setItems] = useState<ReadonlyArray<InspectionItem>>([])
  const [draft, setDraft] = useState<DraftItem>(EMPTY_ITEM)
  const [submitted, setSubmitted] = useState<SubmittedRef | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)

  const fence = useMemo(
    () => (location.state.coords ? nearestFence(location.state.coords) : null),
    [location.state.coords]
  )

  const defaultInspectionId = useMemo(() => generateInspectionId(), [])

  const conditionOptions = useMemo<ReadonlyArray<ConditionOption>>(
    () => [
      { value: 'good', label: t.drillHole.condGood },
      { value: 'fair', label: t.drillHole.condFair },
      { value: 'poor', label: t.drillHole.condPoor },
      { value: 'damaged', label: t.drillHole.condDamaged }
    ],
    [t]
  )

  const form = useForm<InspectionForm>({
    resolver: zodResolver(inspectionFormSchema),
    mode: 'onChange',
    defaultValues: {
      inspectionId: defaultInspectionId,
      kind: 'move_in',
      unitRef: ''
    }
  })

  const addItem = useCallback((): void => {
    if (draft.area.trim().length === 0) {
      return
    }
    const next: InspectionItem = {
      id: newItemId(),
      area: draft.area.trim(),
      condition: draft.condition,
      notes: draft.notes.trim()
    }
    setItems((current) => [...current, next])
    setDraft(EMPTY_ITEM)
  }, [draft])

  const removeItem = useCallback((id: string): void => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const payload: InspectionPayload = {
        inspectionId: values.inspectionId,
        kind: values.kind,
        unitRef: values.unitRef ?? '',
        items,
        gps: location.state.coords
          ? {
              latitude: location.state.coords.latitude,
              longitude: location.state.coords.longitude,
              accuracy: location.state.coords.accuracy,
              capturedAt: location.state.coords.capturedAt
            }
          : null,
        fence: fence
          ? {
              siteId: fence.fence.siteId,
              siteName: fence.fence.siteName,
              insideFence: fence.insideFence,
              distanceMeters: fence.distance
            }
          : null,
        submittedAt: Date.now()
      }
      const entry = await enqueueWrite('inspection', payload)
      setSubmitted({ queueId: entry.id })
    } catch (error) {
      console.error('Inspection submit failed:', error)
    } finally {
      setSubmitting(false)
    }
  })

  const resetForm = useCallback((): void => {
    form.reset({ inspectionId: generateInspectionId(), kind: 'move_in', unitRef: '' })
    setItems([])
    setDraft(EMPTY_ITEM)
    setSubmitted(null)
  }, [form])

  if (submitted) {
    return (
      <View>
        <Section title={t.common.saved}>
          <ConfirmationCard
            title={t.drillHole.confirmTitle}
            message={t.drillHole.confirmMessage}
            refLabel={t.common.reference}
            refValue={submitted.queueId}
            pendingSyncLabel={t.common.pendingSync}
            online={online}
          />
        </Section>
        <Button label={t.common.newEntry} variant="secondary" onPress={resetForm} />
      </View>
    )
  }

  return (
    <View>
      <Section title="GPS">
        <GpsCard
          state={location.state}
          fence={fence}
          insideLabel={t.drillHole.fenceInside}
          outsideLabel={t.drillHole.fenceOutside}
          capturingLabel={t.drillHole.gpsCapturing}
          latLngLabel={t.drillHole.gpsLatLng}
          accuracyLabel={t.drillHole.gpsAccuracy}
          distanceLabel={t.drillHole.fenceDistance}
          noGpsLabel={t.drillHole.fenceNoGps}
        />
        <Button
          label={t.drillHole.gpsCapture}
          variant="ghost"
          onPress={() => void location.capture()}
        />
      </Section>
      <InspectionFields control={form.control} setValue={form.setValue} t={t} />
      <Section title={t.drillHole.layers} hint={t.drillHole.layersHint}>
        <InspectionItemList
          items={items}
          draft={draft}
          onChangeDraft={setDraft}
          onAdd={addItem}
          onRemove={removeItem}
          addLabel={t.drillHole.addItem}
          removeLabel={t.common.cancel}
          areaLabel={t.drillHole.itemArea}
          conditionLabel={t.drillHole.itemCondition}
          notesLabel={t.drillHole.itemNotes}
          emptyLabel={t.common.empty}
          conditionOptions={conditionOptions}
        />
      </Section>
      <View style={styles.actions}>
        <Button
          label={submitting ? t.common.submitting : t.common.submit}
          onPress={() => void onSubmit()}
          loading={submitting}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    marginTop: spacing.md
  }
})
