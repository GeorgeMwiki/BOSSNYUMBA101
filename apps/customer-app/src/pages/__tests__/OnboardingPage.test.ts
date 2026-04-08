/**
 * Tests for OnboardingPage helpers.
 *
 * These tests focus on the pure functions that drive multi-step
 * navigation, validation, and localStorage persistence. They run in
 * the default Node vitest environment; a minimal in-memory
 * `localStorage` shim is installed so the helpers that guard on
 * `typeof globalThis.localStorage` exercise their happy path.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  INITIAL_ONBOARDING_STATE,
  ONBOARDING_STORAGE_KEY,
  clearPersistedOnboardingState,
  loadPersistedOnboardingState,
  nextStep,
  persistOnboardingState,
  previousStep,
  validateOnboardingStep,
  type OnboardingFormState,
} from '../../components/onboarding/state';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    get size() {
      return store.size;
    },
  };
}

function makeValidState(): OnboardingFormState {
  return {
    profile: {
      firstName: 'Ada',
      lastName: 'Wanjiru',
      idNumber: 'ID12345',
      phone: '0712345678',
    },
    property: { propertyId: 'sunset-204', unitId: '204' },
    documents: [{ category: 'ID_DOCUMENT', documentId: 'doc-1', filename: 'id.pdf' }],
    agreedToTerms: true,
    currentStep: 'profile',
  };
}

describe('OnboardingPage helpers', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = createMemoryStorage();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  describe('validateOnboardingStep', () => {
    it('accepts a fully populated profile step', () => {
      const result = validateOnboardingStep('profile', makeValidState());
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('rejects an empty profile step with field-level errors', () => {
      const result = validateOnboardingStep('profile', INITIAL_ONBOARDING_STATE);
      expect(result.ok).toBe(false);
      expect(result.errors.firstName).toBeTruthy();
      expect(result.errors.lastName).toBeTruthy();
      expect(result.errors.idNumber).toBeTruthy();
      expect(result.errors.phone).toBeTruthy();
    });

    it('rejects a too-short ID number', () => {
      const state = makeValidState();
      state.profile.idNumber = 'abc';
      const result = validateOnboardingStep('profile', state);
      expect(result.ok).toBe(false);
      expect(result.errors.idNumber).toMatch(/valid ID/);
    });

    it('rejects a too-short phone number', () => {
      const state = makeValidState();
      state.profile.phone = '123';
      const result = validateOnboardingStep('profile', state);
      expect(result.ok).toBe(false);
      expect(result.errors.phone).toMatch(/valid phone/);
    });

    it('requires a property selection', () => {
      const state = makeValidState();
      state.property.propertyId = '';
      expect(validateOnboardingStep('property', state).ok).toBe(false);
    });

    it('requires at least one uploaded document', () => {
      const state = makeValidState();
      state.documents = [];
      expect(validateOnboardingStep('documents', state).ok).toBe(false);
    });

    it('requires terms acceptance on the final step', () => {
      const state = makeValidState();
      state.agreedToTerms = false;
      const result = validateOnboardingStep('terms', state);
      expect(result.ok).toBe(false);
      expect(result.errors.agreedToTerms).toBeTruthy();
    });

    it('passes terms step when accepted', () => {
      expect(validateOnboardingStep('terms', makeValidState()).ok).toBe(true);
    });
  });

  describe('step navigation helpers', () => {
    it('advances through every step in order', () => {
      expect(nextStep('profile')).toBe('property');
      expect(nextStep('property')).toBe('documents');
      expect(nextStep('documents')).toBe('terms');
      expect(nextStep('terms')).toBeNull();
    });

    it('walks backwards through every step in order', () => {
      expect(previousStep('profile')).toBeNull();
      expect(previousStep('property')).toBe('profile');
      expect(previousStep('documents')).toBe('property');
      expect(previousStep('terms')).toBe('documents');
    });
  });

  describe('persistence', () => {
    it('returns the initial state when nothing is stored', () => {
      expect(loadPersistedOnboardingState()).toEqual(INITIAL_ONBOARDING_STATE);
    });

    it('round-trips a state through localStorage', () => {
      const state = makeValidState();
      persistOnboardingState(state);
      expect(loadPersistedOnboardingState()).toEqual(state);
    });

    it('clears persisted state on completion', () => {
      persistOnboardingState(makeValidState());
      clearPersistedOnboardingState();
      expect(loadPersistedOnboardingState()).toEqual(INITIAL_ONBOARDING_STATE);
    });

    it('falls back to initial state when stored payload is malformed', () => {
      const storage = (globalThis as { localStorage: Storage }).localStorage;
      storage.setItem(ONBOARDING_STORAGE_KEY, '{not json');
      expect(loadPersistedOnboardingState()).toEqual(INITIAL_ONBOARDING_STATE);
    });
  });
});
