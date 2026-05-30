/**
 * Superpower 2 — prefill. Inspection / ticket / close-out forms
 * subscribe by formId so unrelated payloads are ignored.
 */
import { useEffect } from 'react'
import { formPrefillBus, type FormPrefillEvent } from './bus'

export type PrefillApplier = (values: Readonly<Record<string, unknown>>, submit: boolean) => void

export function publishPrefill(event: FormPrefillEvent): void {
  formPrefillBus.publish(event)
}

export function useSuperpowerPrefill(formId: string, apply: PrefillApplier): void {
  useEffect(() => {
    return formPrefillBus.subscribe((event) => {
      if (event.formId !== formId) return
      apply(event.values, event.submitOnAccept ?? false)
    })
  }, [formId, apply])
}
