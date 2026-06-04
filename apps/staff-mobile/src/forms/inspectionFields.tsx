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
      depth: string
      sampleTagLabel: string
      sampleTagPlaceholder: string
      scanSampleTag: string
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
        name="depth"
        render={({ field, fieldState }) => (
          <Field
            label={t.drillHole.depth}
            value={field.value}
            onChangeText={field.onChange}
            keyboardType="decimal-pad"
            error={fieldState.error ? t.common.required : null}
          />
        )}
      />
      <Controller
        control={control}
        name="assetTag"
        render={({ field }) => (
          <Field
            label={t.drillHole.sampleTagLabel}
            value={field.value ?? ''}
            onChangeText={field.onChange}
            autoCapitalize="characters"
            placeholder={t.drillHole.sampleTagPlaceholder}
          />
        )}
      />
      <Button
        label={t.drillHole.scanSampleTag}
        variant="ghost"
        onPress={() => {
          // See gh-issue #14: requires EAS dev build — wire to
          // expo-barcode-scanner when the asset-tag scanner module
          // ships. For now we simulate a scan by generating a tag
          // prefix so QA can exercise the flow.
          const simulated = `AST-${Date.now().toString().slice(-6)}`
          setValue('assetTag', simulated, { shouldValidate: true })
        }}
      />
    </Section>
  )
}
