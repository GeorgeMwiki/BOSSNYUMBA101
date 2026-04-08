/**
 * Onboarding form state helpers
 *
 * Pure, framework-free helpers shared by OnboardingPage and its tests.
 * Keep this file free of React or next/* imports so it stays testable
 * in a Node vitest environment.
 */

export type OnboardingStepId = 'profile' | 'property' | 'documents' | 'terms';

export const ONBOARDING_STEPS: readonly OnboardingStepId[] = [
  'profile',
  'property',
  'documents',
  'terms',
] as const;

export interface OnboardingFormState {
  profile: {
    firstName: string;
    lastName: string;
    idNumber: string;
    phone: string;
  };
  property: {
    propertyId: string;
    unitId: string;
  };
  documents: Array<{
    category: string;
    documentId?: string;
    filename?: string;
    url?: string;
  }>;
  agreedToTerms: boolean;
  currentStep: OnboardingStepId;
}

export const ONBOARDING_STORAGE_KEY = 'customer_onboarding_state_v1';

export const INITIAL_ONBOARDING_STATE: OnboardingFormState = {
  profile: { firstName: '', lastName: '', idNumber: '', phone: '' },
  property: { propertyId: '', unitId: '' },
  documents: [],
  agreedToTerms: false,
  currentStep: 'profile',
};

export interface StepValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

export function validateOnboardingStep(
  step: OnboardingStepId,
  state: OnboardingFormState
): StepValidationResult {
  const errors: Record<string, string> = {};
  if (step === 'profile') {
    if (!state.profile.firstName.trim()) errors.firstName = 'First name is required';
    if (!state.profile.lastName.trim()) errors.lastName = 'Last name is required';
    if (!state.profile.idNumber.trim()) {
      errors.idNumber = 'ID number is required';
    } else if (!/^[A-Za-z0-9-]{5,}$/.test(state.profile.idNumber.trim())) {
      errors.idNumber = 'Enter a valid ID number';
    }
    const normalizedPhone = state.profile.phone.replace(/\D/g, '');
    if (!normalizedPhone) {
      errors.phone = 'Phone number is required';
    } else if (normalizedPhone.length < 9) {
      errors.phone = 'Enter a valid phone number';
    }
  } else if (step === 'property') {
    if (!state.property.propertyId.trim()) {
      errors.propertyId = 'Select a property';
    }
  } else if (step === 'documents') {
    if (!state.documents.length) {
      errors.documents = 'Upload at least one document';
    }
  } else if (step === 'terms') {
    if (!state.agreedToTerms) {
      errors.agreedToTerms = 'You must accept the terms to continue';
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function getStorage(): StorageLike | null {
  if (typeof globalThis === 'undefined') return null;
  const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
  return storage ?? null;
}

export function loadPersistedOnboardingState(): OnboardingFormState {
  const storage = getStorage();
  if (!storage) return INITIAL_ONBOARDING_STATE;
  try {
    const raw = storage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return INITIAL_ONBOARDING_STATE;
    const parsed = JSON.parse(raw) as Partial<OnboardingFormState>;
    return {
      ...INITIAL_ONBOARDING_STATE,
      ...parsed,
      profile: { ...INITIAL_ONBOARDING_STATE.profile, ...(parsed.profile ?? {}) },
      property: { ...INITIAL_ONBOARDING_STATE.property, ...(parsed.property ?? {}) },
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    };
  } catch {
    return INITIAL_ONBOARDING_STATE;
  }
}

export function persistOnboardingState(state: OnboardingFormState): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function clearPersistedOnboardingState(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function nextStep(current: OnboardingStepId): OnboardingStepId | null {
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx < 0 || idx >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[idx + 1];
}

export function previousStep(current: OnboardingStepId): OnboardingStepId | null {
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx <= 0) return null;
  return ONBOARDING_STEPS[idx - 1];
}
