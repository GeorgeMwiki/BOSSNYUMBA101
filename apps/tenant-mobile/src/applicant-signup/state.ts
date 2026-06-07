/**
 * Applicant signup wizard state machine.
 *
 * AsyncStorage-backed React Context so a resumed app session returns the
 * applicant to the screen they left, with every field they had filled. The
 * machine is intentionally immutable — every transition returns a new
 * state object via the spread operator. No callsite mutates state.
 *
 * Persistence layout:
 *
 *   AsyncStorage["bossnyumba.applicant_signup.v1"] = JSON.stringify(state)
 *
 *   The version suffix lets us bump the schema without colliding with
 *   in-progress signups in older builds (we just discard them).
 *
 * Why not a reducer / Redux? The flow is tiny (≤ 7 atoms) and the
 * Context API + setState is enough; pulling Redux into a mobile bundle
 * is dead-weight here.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import type { ApplicantAccountKind, VerificationStepKey } from './kyc-requirements'

// ─── Wire types ──────────────────────────────────────────────────────

export type ApplicantCountry =
  | 'TZ'
  | 'KE'
  | 'UG'
  | 'NG'
  | 'EU'
  | 'OTHER'

// eslint-disable-next-line bossnyumba/no-jurisdictional-literal -- reason: supported-currency-code allowlist/union type, not a hard-coded business currency
export type ApplicantCurrency = 'USD' | 'TZS' | 'KES' | 'EUR'

export type ApplicantLanguage = 'sw' | 'en'

export type ApplicantEmploymentKind =
  | 'salaried'
  | 'self_employed'
  | 'business_owner'
  | 'investor'
  | 'other'

export interface IndividualFields {
  readonly fullName: string
  readonly phoneE164: string
  readonly email: string
  readonly nationalIdNumber: string
}

export interface BusinessFields {
  readonly orgName: string
  readonly employmentKind: ApplicantEmploymentKind
  readonly businessRegistrationNumber: string
  readonly taxId: string
  readonly contactFullName: string
  readonly contactPhoneE164: string
  readonly contactEmail: string
}

export interface ApplicantSignupState {
  /** Set once the user picks INDIVIDUAL or BUSINESS in the kind picker. */
  readonly kind: ApplicantAccountKind | null
  readonly country: ApplicantCountry
  readonly preferredCurrency: ApplicantCurrency
  readonly preferredLanguage: ApplicantLanguage
  readonly individual: IndividualFields
  readonly business: BusinessFields
  /** Server response fields persisted after POST /signup succeeds. */
  readonly applicantOrgId: string | null
  readonly tenantId: string | null
  readonly userId: string | null
  readonly otpVerified: boolean
  /** Atom keys the user has completed. */
  readonly kycAtomsCompleted: ReadonlyArray<VerificationStepKey>
}

export const STORAGE_KEY = 'bossnyumba.applicant_signup.v1'

export const initialApplicantSignupState: ApplicantSignupState = {
  kind: null,
  country: 'TZ',
  preferredCurrency: 'USD',
  preferredLanguage: 'sw',
  individual: {
    fullName: '',
    phoneE164: '',
    email: '',
    nationalIdNumber: ''
  },
  business: {
    orgName: '',
    employmentKind: 'salaried',
    businessRegistrationNumber: '',
    taxId: '',
    contactFullName: '',
    contactPhoneE164: '',
    contactEmail: ''
  },
  applicantOrgId: null,
  tenantId: null,
  userId: null,
  otpVerified: false,
  kycAtomsCompleted: []
}

// ─── Context ─────────────────────────────────────────────────────────

export interface ApplicantSignupContextValue {
  readonly state: ApplicantSignupState
  readonly hydrated: boolean
  readonly setKind: (kind: ApplicantAccountKind) => void
  readonly setLocale: (
    country: ApplicantCountry,
    currency: ApplicantCurrency,
    language: ApplicantLanguage
  ) => void
  readonly setIndividual: (fields: Partial<IndividualFields>) => void
  readonly setBusiness: (fields: Partial<BusinessFields>) => void
  readonly setServerResult: (result: {
    readonly applicantOrgId: string
    readonly tenantId: string
    readonly userId: string
  }) => void
  readonly markOtpVerified: () => void
  readonly markAtomCompleted: (atom: VerificationStepKey) => void
  readonly reset: () => Promise<void>
}

const ApplicantSignupContext =
  createContext<ApplicantSignupContextValue | null>(null)

// ─── Persistence helpers ─────────────────────────────────────────────

async function loadState(): Promise<ApplicantSignupState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return initialApplicantSignupState
    }
    const parsed = JSON.parse(raw) as Partial<ApplicantSignupState>
    return {
      ...initialApplicantSignupState,
      ...parsed,
      individual: {
        ...initialApplicantSignupState.individual,
        ...(parsed.individual ?? {})
      },
      business: {
        ...initialApplicantSignupState.business,
        ...(parsed.business ?? {})
      },
      kycAtomsCompleted: parsed.kycAtomsCompleted ?? []
    }
  } catch {
    return initialApplicantSignupState
  }
}

async function persistState(state: ApplicantSignupState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Persistence is best-effort; the in-memory state is the source of truth.
  }
}

// ─── Provider ────────────────────────────────────────────────────────

export interface ApplicantSignupProviderProps {
  readonly children: ReactNode
}

export function ApplicantSignupProvider({
  children
}: ApplicantSignupProviderProps): JSX.Element {
  const [state, setState] = useState<ApplicantSignupState>(
    initialApplicantSignupState
  )
  const [hydrated, setHydrated] = useState<boolean>(false)

  useEffect(() => {
    let mounted = true
    void loadState().then((next) => {
      if (mounted) {
        setState(next)
        setHydrated(true)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }
    void persistState(state)
  }, [hydrated, state])

  const setKind = useCallback((kind: ApplicantAccountKind) => {
    setState((prev) => ({ ...prev, kind }))
  }, [])

  const setLocale = useCallback(
    (
      country: ApplicantCountry,
      currency: ApplicantCurrency,
      language: ApplicantLanguage
    ) => {
      setState((prev) => ({
        ...prev,
        country,
        preferredCurrency: currency,
        preferredLanguage: language
      }))
    },
    []
  )

  const setIndividual = useCallback((fields: Partial<IndividualFields>) => {
    setState((prev) => ({
      ...prev,
      individual: { ...prev.individual, ...fields }
    }))
  }, [])

  const setBusiness = useCallback((fields: Partial<BusinessFields>) => {
    setState((prev) => ({
      ...prev,
      business: { ...prev.business, ...fields }
    }))
  }, [])

  const setServerResult = useCallback(
    (result: { applicantOrgId: string; tenantId: string; userId: string }) => {
      setState((prev) => ({
        ...prev,
        applicantOrgId: result.applicantOrgId,
        tenantId: result.tenantId,
        userId: result.userId
      }))
    },
    []
  )

  const markOtpVerified = useCallback(() => {
    setState((prev) => ({ ...prev, otpVerified: true }))
  }, [])

  const markAtomCompleted = useCallback((atom: VerificationStepKey) => {
    setState((prev) => {
      if (prev.kycAtomsCompleted.includes(atom)) {
        return prev
      }
      return {
        ...prev,
        kycAtomsCompleted: [...prev.kycAtomsCompleted, atom]
      }
    })
  }, [])

  const reset = useCallback(async () => {
    setState(initialApplicantSignupState)
    try {
      await AsyncStorage.removeItem(STORAGE_KEY)
    } catch {
      // Best-effort
    }
  }, [])

  const value = useMemo<ApplicantSignupContextValue>(
    () => ({
      state,
      hydrated,
      setKind,
      setLocale,
      setIndividual,
      setBusiness,
      setServerResult,
      markOtpVerified,
      markAtomCompleted,
      reset
    }),
    [
      state,
      hydrated,
      setKind,
      setLocale,
      setIndividual,
      setBusiness,
      setServerResult,
      markOtpVerified,
      markAtomCompleted,
      reset
    ]
  )

  return createElement(ApplicantSignupContext.Provider, { value }, children)
}

export function useApplicantSignup(): ApplicantSignupContextValue {
  const ctx = useContext(ApplicantSignupContext)
  if (!ctx) {
    throw new Error(
      'useApplicantSignup must be used inside <ApplicantSignupProvider>'
    )
  }
  return ctx
}

// ─── Pure helpers (no hooks) ─────────────────────────────────────────

/**
 * Build the API request body from the current wizard state. Returns
 * `null` if the state isn't ready (no kind chosen) so the caller can
 * route the user back to the kind picker.
 */
export function buildSignupBody(
  state: ApplicantSignupState
):
  | { readonly kind: 'individual'; readonly body: Record<string, unknown> }
  | { readonly kind: 'business'; readonly body: Record<string, unknown> }
  | null {
  if (state.kind === 'individual') {
    const body: Record<string, unknown> = {
      kind: 'individual',
      country: state.country,
      fullName: state.individual.fullName,
      phoneE164: state.individual.phoneE164,
      email: state.individual.email,
      preferredCurrency: state.preferredCurrency,
      preferredLanguage: state.preferredLanguage
    }
    if (state.individual.nationalIdNumber.length > 0) {
      body.nationalIdNumber = state.individual.nationalIdNumber
    }
    return { kind: 'individual', body }
  }
  if (state.kind === 'business') {
    return {
      kind: 'business',
      body: {
        kind: 'business',
        country: state.country,
        orgName: state.business.orgName,
        employmentKind: state.business.employmentKind,
        businessRegistrationNumber: state.business.businessRegistrationNumber,
        taxId: state.business.taxId,
        contactFullName: state.business.contactFullName,
        contactPhoneE164: state.business.contactPhoneE164,
        contactEmail: state.business.contactEmail,
        preferredCurrency: state.preferredCurrency,
        preferredLanguage: state.preferredLanguage
      }
    }
  }
  return null
}

/** Re-export for callers that only need the storage key (tests). */
export const APPLICANT_SIGNUP_STORAGE_KEY = STORAGE_KEY
