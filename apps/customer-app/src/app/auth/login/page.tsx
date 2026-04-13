'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithPhone } = useAuth();
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        router.push('/');
      } else {
        setError(result.message ?? 'Invalid email or password');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginWithPhone(phone);
      if (result.success) {
        router.push(`/auth/otp?phone=${encodeURIComponent(phone)}`);
      } else {
        setError(result.message ?? 'Something went wrong');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">BOSSNYUMBA</h1>
          <p className="text-gray-500 mt-2 text-base">Sign in to manage your tenancy</p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode('email'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => { setMode('phone'); setError(''); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'phone' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Phone
          </button>
        </div>

        {mode === 'email' ? (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-12"
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
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
                  Sign in
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="text-center">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-primary-600 font-medium"
              >
                Forgot password?
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePhoneLogin} className="space-y-4">
            <div>
              <label htmlFor="phone" className="label">Phone Number</label>
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
                  Send OTP
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-center text-sm text-gray-500">
              We&apos;ll send you a one-time code to verify your number.
            </p>
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
