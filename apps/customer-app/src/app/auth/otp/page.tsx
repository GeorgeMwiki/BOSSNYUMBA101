'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OTPVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyOtp, loginWithPhone, isAuthenticated } = useAuth();

  const phoneParam = searchParams.get('phone') ?? '';
  const isRegister = searchParams.get('mode') === 'register';

  const [otp, setOtp] = useState('');
  const [phone, setPhone] = useState(phoneParam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setPhone(phoneParam);
  }, [phoneParam]);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const startResendCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(value);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await verifyOtp(phone, otp);
      if (result.success) {
        router.replace('/');
      } else {
        setError(result.message ?? 'Invalid code. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setError('');
    const result = await loginWithPhone(phone);
    if (result.success) {
      startResendCooldown();
    } else {
      setError(result.message ?? 'Failed to resend. Try again.');
    }
  };

  if (!phone) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-gray-600">Invalid or missing phone number.</p>
          <Link href="/auth/login" className="text-primary-600 font-medium mt-4 inline-block">
            Back to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
        <Link
          href="/auth/login"
          className="flex items-center gap-2 text-gray-600 mb-6 -ml-2 w-fit"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </Link>

        <div className="mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
            <KeyRound className="w-6 h-6 text-primary-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Enter verification code</h1>
          <p className="text-gray-500 mt-2">
            We sent a 6-digit code to {phone}. Enter it below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="otp" className="label">
              Verification code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={otp}
              onChange={handleOtpChange}
              placeholder="000000"
              className="input text-center text-2xl tracking-[0.5em] font-mono"
              maxLength={OTP_LENGTH}
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || otp.length !== OTP_LENGTH}
            className="btn-primary w-full py-4 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying...
              </span>
            ) : (
              'Verify'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">Didn&apos;t receive the code?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="text-primary-600 font-medium mt-1 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-8">
          Demo: Use OTP <strong>123456</strong> to sign in
        </p>
      </div>
    </main>
  );
}
