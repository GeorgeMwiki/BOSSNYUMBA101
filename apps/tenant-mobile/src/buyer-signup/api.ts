/**
 * Typed wrappers around the applicant/renter self-signup endpoints.
 *
 *   - POST /api/v1/onboarding/signup                  — create the org
 *   - POST /api/v1/documents (per identity fragment)  — upload one KYC
 *     verification document
 *
 * NOTE (flagged): the original "KYC atoms" route had no property-domain
 * equivalent (it was a mineral-buyer identity-fragment API). Renter
 * identity verification is closest to document verification on
 * `/api/v1/documents`; the atom-upload wrapper points there pending a
 * dedicated applicant-onboarding KYC endpoint. The Buyer* symbol names +
 * `buyer_signup.*` i18n keys still need renaming to applicant/tenant in a
 * coordinated pass (the i18n JSON is outside this file's ownership).
 */

import { apiFetch } from '@/api/client'
import type { BuyerKycAtomKey, BuyerAccountKind } from './kyc-atoms'

export interface BuyerSignupResponse {
  readonly buyerOrgId: string
  readonly tenantId: string
  readonly userId: string
  readonly kind: BuyerAccountKind
  readonly kycAtoms: ReadonlyArray<BuyerKycAtomKey>
  readonly otpRequired: boolean
  readonly signupStatus: 'pending_otp_verification'
}

export async function submitBuyerSignup(
  body: Record<string, unknown>
): Promise<BuyerSignupResponse> {
  return apiFetch<BuyerSignupResponse>('/api/v1/onboarding/signup', {
    method: 'POST',
    body
  })
}

export interface UploadAtomInput {
  readonly atomType: BuyerKycAtomKey
  readonly payload: Record<string, unknown>
}

export interface UploadAtomResponse {
  readonly success: true
  readonly data: {
    readonly id: string
    readonly atomType: BuyerKycAtomKey
    readonly status: string
  }
}

export async function uploadKycAtom(
  input: UploadAtomInput
): Promise<UploadAtomResponse> {
  return apiFetch<UploadAtomResponse>(
    `/api/v1/documents/kyc/${input.atomType}`,
    {
      method: 'POST',
      body: input.payload
    }
  )
}
