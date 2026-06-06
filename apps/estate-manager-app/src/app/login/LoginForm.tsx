'use client';

/**
 * Operator sign-in — email + password via Supabase.
 *
 * Estate managers are invited staff (no public signup), so the operator
 * norm is email + password, matching HQ staff sign-in. `signInWithEmail
 * Password` establishes the Supabase session; AuthProvider's
 * onAuthStateChange then mirrors it into the React tree and the api-client
 * bearer. On success we honour the `?next=` return path captured by the
 * AuthGate redirect, falling back to the home dashboard.
 *
 * Live email/password auth is exercised against whatever Supabase project
 * the deploy is configured with; no provider config is needed beyond the
 * existing NEXT_PUBLIC_SUPABASE_* env vars.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { Logomark } from '@bossnyumba/design-system';
import { useAuth } from '@/providers/AuthProvider';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/** Only allow same-origin relative paths as a post-login redirect target. */
function safeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export function LoginForm(): JSX.Element {
  const t = useTranslations('authLogin');
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { signInWithEmailPassword } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    const result = await signInWithEmailPassword(email, password);
    if (result.success) {
      router.replace(next);
      return;
    }
    setError('root', { message: result.message ?? t('genericError') });
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <Logomark size={40} />
          <div>
            <div className="font-display text-xl leading-tight">{t('title')}</div>
            <div className="font-mono text-[0.68rem] uppercase tracking-widest text-neutral-500">
              {t('subtitle')}
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="label">
              {t('emailLabel')}
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
                aria-hidden="true"
              />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="input pl-10"
                placeholder={t('emailPlaceholder')}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="label">
              {t('passwordLabel')}
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
                aria-hidden="true"
              />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input pl-10"
                placeholder={t('passwordPlaceholder')}
                aria-invalid={!!errors.password}
                {...register('password')}
              />
            </div>
            {errors.password && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {errors.root && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-600"
            >
              {errors.root.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex min-h-[48px] w-full items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              <>
                {t('signIn')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">{t('helperText')}</p>
      </div>
    </main>
  );
}
