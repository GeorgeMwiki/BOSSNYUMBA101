import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Button } from '../../src/forms/Button'
import { Field } from '../../src/forms/Field'
import { WizardShell } from '../../src/onboarding/WizardShell'
import { useOnboardingDraft } from '../../src/onboarding/state'
import { pickStrings } from '../../src/i18n'

/**
 * Adaptive property step. Owner → title-deed reference. Manager/Employee →
 * property site code of the building they work at.
 *
 * The underlying draft fields `titleDeedRef` / `siteCode` are defined in
 * the shared onboarding state (`src/onboarding/state.ts`).
 */
export default function SiteStep(): JSX.Element {
  const { current, update, markStepComplete } = useOnboardingDraft()
  const t = useMemo(() => pickStrings(current.lang), [current.lang])
  const copy = t.onboarding.site
  const isOwner = current.role === 'owner'

  const [error, setError] = useState<string | null>(null)

  function next(): void {
    const value = isOwner ? current.titleDeedRef : current.siteCode
    if (value.trim().length < 3) {
      setError(t.common.required)
      return
    }
    markStepComplete('site')
    if (current.role === 'employee' || current.role === 'manager') {
      router.push('/onboarding/certifications')
      return
    }
    router.push('/onboarding/biometric')
  }

  return (
    <WizardShell
      badge={isOwner ? 'DEED' : 'SITE'}
      title={copy.title}
      subtitle={isOwner ? copy.subtitleOwner : copy.subtitleWorker}
      footer={<Button label={copy.cta} onPress={next} />}
    >
      {isOwner ? (
        <Field
          label={copy.deedLabel}
          value={current.titleDeedRef}
          onChangeText={(value) => {
            setError(null)
            update({ titleDeedRef: value.toUpperCase() })
          }}
          placeholder={copy.deedPlaceholder}
          autoCapitalize="characters"
          error={error}
        />
      ) : (
        <Field
          label={copy.siteCodeLabel}
          value={current.siteCode}
          onChangeText={(value) => {
            setError(null)
            update({ siteCode: value.toUpperCase() })
          }}
          placeholder={copy.siteCodePlaceholder}
          autoCapitalize="characters"
          error={error}
        />
      )}
    </WizardShell>
  )
}
