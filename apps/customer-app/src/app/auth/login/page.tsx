'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';

type Mode = 'phone' | 'password';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { loginWithPhone, loginWithPassword, isAuthenticated, loading: authLoading } =
    useAuth();

  const [mode, setMode] = useState<Mode>('phone');
  const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, router]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await loginWithPhone(phone);
      if (result.success) {
        toast.success('Verification code sent');
        router.push(`/auth/otp?phone=${encodeURIComponent(phone)}`);
      } else {
        const msg = result.message ?? 'Something went wrong';
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = 'Something went wrong. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await loginWithPassword(identifier, password);
      if (result.success) {
        toast.success('Welcome back');
        router.replace('/');
      } else {
        const msg = result.message ?? 'Unable to sign in';
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = 'Something went wrong. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">BOSSNYUMBA</h1>
          <p className="text-gray-500 mt-2 text-base">Sign in to manage your tenancy</p>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('phone');
              setError('');
            }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              mode === 'phone'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Phone + OTP
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('password');
              setError('');
            }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              mode === 'password'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Email + Password
          </button>
        </div>

        {mode === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div>
              <label htmlFor="phone" className="label">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254 7XX XXX XXX"
                  className="input pl-12"
                  required
                  autoComplete="tel"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 min-h-[52px]"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Send OTP
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-center text-sm text-gray-500">
              We&apos;ll send you a one-time code to verify your number.
            </p>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div>
              <label htmlFor="identifier" className="label">
                Email or Phone
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-12"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="input pl-12"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 min-h-[52px]"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/auth/register"
            className="inline-block py-3 px-4 text-primary-600 font-medium min-h-[48px] leading-normal"
          >
            New here? Create an account
          </Link>
        </div>
      </div>
    </main>
  );
}
