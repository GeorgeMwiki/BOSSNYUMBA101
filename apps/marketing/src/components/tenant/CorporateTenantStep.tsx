'use client';

import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import {
  TENANT_BUSINESS_KINDS,
  TENANT_COUNTRY_CODES,
  TENANT_CURRENCY_CODES,
  TENANT_LANGUAGE_CODES,
  type CorporateTenantDraft,
  type TenantBusinessKind,
  type TenantCountryCode,
  type TenantCurrencyCode,
  type TenantLanguageCode,
} from './types';
import { Field } from './Field';
import { getMessages, type Locale } from '@/lib/i18n';

interface CorporateTenantStepProps {
  readonly locale: Locale;
  readonly draft: CorporateTenantDraft;
  readonly onChange: (draft: CorporateTenantDraft) => void;
  readonly onBack: () => void;
  readonly onSubmit: (draft: CorporateTenantDraft) => Promise<void> | void;
  readonly submitting: boolean;
  readonly serverError: string | null;
}

type FieldErrors = Readonly<Partial<Record<keyof CorporateTenantDraft, string>>>;

// eslint-disable-next-line bossnyumba/no-jurisdictional-literal -- reason: TZ-launch default dial code placeholder in marketing signup form; locale selection handles expansion markets
const TZ_PHONE_PLACEHOLDER = '+255712345678';

/**
 * Step 2b — business-tenant details form.
 *
 * Same pattern as `IndividualTenantStep` but with the additional
 * BRELA / TIN / contact-person fields the API requires when
 * `kind === 'business'`.
 */
export function CorporateTenantStep({
  locale,
  draft,
  onChange,
  onBack,
  onSubmit,
  submitting,
  serverError,
}: CorporateTenantStepProps) {
  const t = getMessages(locale).tenantSignupPage;
  const errs = t.errors;
  const [errors, setErrors] = useState<FieldErrors>({});

  const schema = z.object({
    orgName: z.string().min(2, errs.orgNameRequired),
    businessKind: z.enum(TENANT_BUSINESS_KINDS, {
      errorMap: () => ({ message: errs.businessKindRequired }),
    }),
    businessRegistrationNumber: z.string().min(1, errs.businessRegRequired),
    taxId: z.string().min(1, errs.taxIdRequired),
    contactFullName: z.string().min(2, errs.fullNameRequired),
    contactPhoneE164: z
      .string()
      .regex(/^\+?[1-9][0-9]{6,19}$/u, errs.phoneInvalid),
    contactEmail: z.string().email(errs.emailInvalid),
  });

  function update<K extends keyof CorporateTenantDraft>(
    key: K,
    value: CorporateTenantDraft[K],
  ): void {
    onChange({ ...draft, [key]: value });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = schema.safeParse({
      orgName: draft.orgName,
      businessKind: draft.businessKind,
      businessRegistrationNumber: draft.businessRegistrationNumber,
      taxId: draft.taxId,
      contactFullName: draft.contactFullName,
      contactPhoneE164: draft.contactPhoneE164,
      contactEmail: draft.contactEmail,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string' && !(path in next)) {
          next[path] = issue.message;
        }
      }
      setErrors(next as FieldErrors);
      return;
    }
    setErrors({});
    await onSubmit(draft);
  }

  return (
    <form
      data-testid="tenant-business-step"
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
    >
      <header>
        <h2 className="font-display text-xl font-semibold text-foreground">
          {t.fields.orgName}
        </h2>
        <p className="text-xs text-foreground/60">{t.fields.orgNameEn}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="orgName"
          label={t.fields.orgName}
          subLabel={t.fields.orgNameEn}
          required
          {...(errors.orgName !== undefined && { error: errors.orgName })}
        >
          <input
            id="orgName"
            data-testid="tenant-business-orgName"
            autoComplete="organization"
            value={draft.orgName}
            onChange={(e) => update('orgName', e.currentTarget.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
          />
        </Field>

        <Field
          id="country"
          label={t.fields.country}
          subLabel={t.fields.countryEn}
          required
        >
          <select
            id="country"
            data-testid="tenant-business-country"
            value={draft.country}
            onChange={(e) =>
              update('country', e.currentTarget.value as TenantCountryCode)
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
          >
            {TENANT_COUNTRY_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="businessKind"
          label={t.fields.businessKind}
          subLabel={t.fields.businessKindEn}
          required
          {...(errors.businessKind !== undefined && { error: errors.businessKind })}
        >
          <select
            id="businessKind"
            data-testid="tenant-business-kind"
            value={draft.businessKind}
            onChange={(e) =>
              update(
                'businessKind',
                e.currentTarget.value as TenantBusinessKind,
              )
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
          >
            {TENANT_BUSINESS_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t.businessKinds[kind]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="businessRegistrationNumber"
          label={t.fields.businessRegistrationNumber}
          subLabel={t.fields.businessRegistrationNumberEn}
          required
          {...(errors.businessRegistrationNumber !== undefined && {
            error: errors.businessRegistrationNumber,
          })}
        >
          <input
            id="businessRegistrationNumber"
            data-testid="tenant-business-brela"
            value={draft.businessRegistrationNumber}
            onChange={(e) =>
              update('businessRegistrationNumber', e.currentTarget.value)
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
          />
        </Field>

        <Field
          id="taxId"
          label={t.fields.taxId}
          subLabel={t.fields.taxIdEn}
          required
          {...(errors.taxId !== undefined && { error: errors.taxId })}
        >
          <input
            id="taxId"
            data-testid="tenant-business-tin"
            value={draft.taxId}
            onChange={(e) => update('taxId', e.currentTarget.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
          />
        </Field>

        <Field
          id="contactFullName"
          label={t.fields.contactFullName}
          subLabel={t.fields.contactFullNameEn}
          required
          {...(errors.contactFullName !== undefined && {
            error: errors.contactFullName,
          })}
        >
          <input
            id="contactFullName"
            data-testid="tenant-business-contact-name"
            autoComplete="name"
            value={draft.contactFullName}
            onChange={(e) => update('contactFullName', e.currentTarget.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
          />
        </Field>

        <Field
          id="contactPhoneE164"
          label={t.fields.contactPhone}
          subLabel={t.fields.contactPhoneEn}
          required
          {...(errors.contactPhoneE164 !== undefined && {
            error: errors.contactPhoneE164,
          })}
        >
          <input
            id="contactPhoneE164"
            data-testid="tenant-business-contact-phone"
            autoComplete="tel"
            inputMode="tel"
            placeholder={TZ_PHONE_PLACEHOLDER}
            value={draft.contactPhoneE164}
            onChange={(e) =>
              update('contactPhoneE164', e.currentTarget.value)
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
          />
        </Field>

        <Field
          id="contactEmail"
          label={t.fields.contactEmail}
          subLabel={t.fields.contactEmailEn}
          required
          {...(errors.contactEmail !== undefined && { error: errors.contactEmail })}
        >
          <input
            id="contactEmail"
            data-testid="tenant-business-contact-email"
            type="email"
            autoComplete="email"
            value={draft.contactEmail}
            onChange={(e) => update('contactEmail', e.currentTarget.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
          />
        </Field>

        <Field
          id="preferredLanguage"
          label={t.fields.preferredLanguage}
          subLabel={t.fields.preferredLanguageEn}
          required
        >
          <select
            id="preferredLanguage"
            data-testid="tenant-business-language"
            value={draft.preferredLanguage}
            onChange={(e) =>
              update(
                'preferredLanguage',
                e.currentTarget.value as TenantLanguageCode,
              )
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
          >
            {TENANT_LANGUAGE_CODES.map((code) => (
              <option key={code} value={code}>
                {code === 'sw' ? 'Kiswahili' : 'English'}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="preferredCurrency"
          label={t.fields.preferredCurrency}
          subLabel={t.fields.preferredCurrencyEn}
          required
        >
          <select
            id="preferredCurrency"
            data-testid="tenant-business-currency"
            value={draft.preferredCurrency}
            onChange={(e) =>
              update(
                'preferredCurrency',
                e.currentTarget.value as TenantCurrencyCode,
              )
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
          >
            {TENANT_CURRENCY_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {serverError ? (
        <div
          role="alert"
          data-testid="tenant-business-server-error"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {serverError}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          data-testid="tenant-business-back"
          className="rounded-md px-3 py-2 text-sm text-foreground/70 transition-colors duration-fast hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
        >
          ‹ {t.actions.back}
        </button>
        <button
          type="submit"
          disabled={submitting}
          data-testid="tenant-business-submit"
          className="rounded-md bg-signal-500 px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-fast ease-out hover:bg-signal-400 hover:shadow-md active:scale-[0.98] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
        >
          {submitting ? t.actions.submitting : t.actions.submit}
        </button>
      </div>
    </form>
  );
}
