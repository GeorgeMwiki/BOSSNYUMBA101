/**
 * Superpower 2 — prefill. Tenant forms (maintenance request, KYC
 * update, billing dispute) subscribe by formId.
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
