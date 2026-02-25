'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@bossnyumba/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithPhone } = useAuth();
  const { t } = useI18n();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await loginWithPhone(phone);
      if (result.success) {
        router.push(`/auth/otp?phone=${encodeURIComponent(phone)}`);
      } else {
        setError(result.message ?? t('common.errors.generic'));
      }
    } catch {
      setError(t('common.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('common.appName')}</h1>
          <p className="text-gray-500 mt-2 text-base">{t('auth.login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="phone" className="label">
              {t('auth.login.phoneLabel')}
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.login.phonePlaceholder')}
                className="input pl-12"
                required
                autoComplete="tel"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 min-h-[52px]"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {t('auth.otp.resendCode')}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {t('auth.otp.subtitle', { destination: phone || t('auth.login.phoneLabel') })}
        </p>

        <div className="mt-8 text-center">
          <Link
            href="/auth/register"
            className="inline-block py-3 px-4 text-primary-600 font-medium min-h-[48px] leading-normal"
          >
            {t('auth.login.noAccount')} {t('auth.login.signUp')}
          </Link>
        </div>
      </div>
    </main>
  );
}
