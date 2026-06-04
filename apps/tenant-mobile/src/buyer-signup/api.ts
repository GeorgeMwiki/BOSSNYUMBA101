/**
 * Typed wrappers around the applicant/renter self-signup endpoints.
 *
 *   - POST /api/v1/onboarding/signup                  — create the org
 *   - POST /api/v1/documents (per identity fragment)  — upload one KYC
 *     verification document
 *
 * NOTE: the original "KYC atoms" route had no property-domain equivalent.
 * Applicant identity verification is closest to document verification on
 * `/api/v1/documents`; the atom-upload wrapper points there pending a
 * dedicated applicant-onboarding KYC endpoint. The `/api/v1/onboarding/*`
 * path segments are the live api-gateway contract, so renaming them needs
 * the gateway in lockstep — only the local symbol names are reframed here.
 */

import { apiFetch } from '@/api/client'
import type { ApplicantKycAtomKey, ApplicantAccountKind } from './kyc-atoms'

export interface ApplicantSignupResponse {
  readonly applicantOrgId: string
  readonly tenantId: string
  readonly userId: string
  readonly kind: ApplicantAccountKind
  readonly kycAtoms: ReadonlyArray<ApplicantKycAtomKey>
  readonly otpRequired: boolean
  readonly signupStatus: 'pending_otp_verification'
}

export async function submitApplicantSignup(
  body: Record<string, unknown>
): Promise<ApplicantSignupResponse> {
  return apiFetch<ApplicantSignupResponse>('/api/v1/onboarding/signup', {
    method: 'POST',
    body
  })
}

export interface UploadAtomInput {
  readonly atomType: ApplicantKycAtomKey
  readonly payload: Record<string, unknown>
}

export interface UploadAtomResponse {
  readonly success: true
  readonly data: {
    readonly id: string
    readonly atomType: ApplicantKycAtomKey
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
