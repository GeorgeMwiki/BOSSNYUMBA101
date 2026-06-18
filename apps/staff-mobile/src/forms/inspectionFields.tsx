import { Controller, type Control, type UseFormSetValue } from 'react-hook-form'
import { Field } from './Field'
import { Dropdown } from './Dropdown'
import { Button } from './Button'
import { Section } from '../components/Section'
import type { InspectionForm, InspectionKind } from './schemas/inspection'

export interface InspectionFieldsProps {
  control: Control<InspectionForm>
  setValue: UseFormSetValue<InspectionForm>
  t: {
    common: { required: string }
    drillHole: {
      section: string
      holeId: string
      kind: string
      kindDiamond: string
      kindRc: string
      kindAuger: string
      unitRefLabel: string
      unitRefPlaceholder: string
      scanUnitRef: string
    }
  }
}

export function InspectionFields({ control, setValue, t }: InspectionFieldsProps): JSX.Element {
  return (
    <Section title={t.drillHole.section}>
      <Controller
        control={control}
        name="inspectionId"
        render={({ field, fieldState }) => (
          <Field
            label={t.drillHole.holeId}
            value={field.value}
            onChangeText={field.onChange}
            autoCapitalize="characters"
            error={fieldState.error ? t.common.required : null}
          />
        )}
      />
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <Dropdown<InspectionKind>
            label={t.drillHole.kind}
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: 'move_in', label: t.drillHole.kindDiamond },
              { value: 'move_out', label: t.drillHole.kindRc },
              { value: 'routine', label: t.drillHole.kindAuger }
            ]}
          />
        )}
      />
      <Controller
        control={control}
        name="unitRef"
        render={({ field }) => (
          <Field
            label={t.drillHole.unitRefLabel}
            value={field.value ?? ''}
            onChangeText={field.onChange}
            autoCapitalize="characters"
            placeholder={t.drillHole.unitRefPlaceholder}
          />
        )}
      />
      <Button
        label={t.drillHole.scanUnitRef}
        variant="ghost"
        onPress={() => {
          // See gh-issue #14: requires EAS dev build — wire to the unit/asset
          // QR scanner when the scanner module ships. For now we simulate a
          // scan by generating a unit reference so QA can exercise the flow.
          const simulated = `UNIT-${Date.now().toString().slice(-6)}`
          setValue('unitRef', simulated, { shouldValidate: true })
        }}
      />
    </Section>
  )
}
