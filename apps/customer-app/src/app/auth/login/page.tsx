'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^\+?[0-9\s-]{7,}$/, 'Please enter a valid phone number'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const t = useTranslations('authLogin');
  const router = useRouter();
  const { loginWithPhone } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '' },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async ({ phone }) => {
    try {
      const result = await loginWithPhone(phone);
      if (result.success) {
        router.push(`/auth/otp?phone=${encodeURIComponent(phone)}`);
      } else {
        setError('root', { message: result.message ?? t('somethingWentWrong') });
      }
    } catch {
      setError('root', { message: t('somethingTryAgain') });
    }
  });

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] relative">
      {/* Wave-21: visible locale switcher on the public login page — lets
          tenants pick Swahili before they receive their OTP. */}
      <div className="absolute top-4 right-4">
        <LocaleSwitcher className="inline-flex items-center gap-2 text-xs text-gray-600" />
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 mt-2 text-base">{t('subtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <div>
            <label htmlFor="phone" className="label">
              {t('phoneLabel')}
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="phone"
                type="tel"
                placeholder={t('phonePlaceholder')}
                autoComplete="tel"
                aria-invalid={!!errors.phone}
                className="input pl-12"
                {...register('phone')}
              />
            </div>
            {errors.phone && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.phone.message}
              </p>
            )}
          </div>

          {errors.root && (
            <div role="alert" className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm">
              {errors.root.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 min-h-[52px]"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {t('sendOtp')}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {t('helperText')}
        </p>

        <div className="mt-8 text-center">
          <Link
            href="/auth/register"
            className="inline-block py-3 px-4 text-primary-600 font-medium min-h-[48px] leading-normal"
          >
            {t('newHereCta')}
          </Link>
        </div>
      </div>
    </main>
  );
}
