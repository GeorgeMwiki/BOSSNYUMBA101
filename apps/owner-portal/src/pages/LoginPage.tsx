import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Shield, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { createZodResolver, Spinner } from '@bossnyumba/design-system';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

type LoginStep = 'credentials' | 'mfa_verify' | 'mfa_setup';

const credentialsSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const mfaCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

type CredentialsForm = z.infer<typeof credentialsSchema>;
type MfaForm = z.infer<typeof mfaCodeSchema>;

export function LoginPage() {
  const [step, setStep] = useState<LoginStep>('credentials');
  const [serverError, setServerError] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [skipLoading, setSkipLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  /* -------------- Credentials form -------------- */
  const credentialsForm = useForm<CredentialsForm>({
    resolver: createZodResolver<CredentialsForm>(credentialsSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });
  const { register: regCreds, handleSubmit: submitCreds, formState: credsState, getValues: getCreds } = credentialsForm;

  /* -------------- MFA verify form -------------- */
  const verifyForm = useForm<MfaForm>({
    resolver: createZodResolver<MfaForm>(mfaCodeSchema),
    defaultValues: { code: '' },
    mode: 'onBlur',
  });
  const { register: regVerify, handleSubmit: submitVerify, formState: verifyState, reset: resetVerify } = verifyForm;

  /* -------------- MFA setup form -------------- */
  const setupForm = useForm<MfaForm>({
    resolver: createZodResolver<MfaForm>(mfaCodeSchema),
    defaultValues: { code: '' },
    mode: 'onBlur',
  });
  const { register: regSetup, handleSubmit: submitSetup, formState: setupState } = setupForm;

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const onSubmitCredentials = submitCreds(async ({ email, password }) => {
    setServerError('');
    try {
      const response = await api.post<{
        success: boolean;
        requiresMfa: boolean;
        mfaSetupRequired: boolean;
        tempToken?: string;
        mfaSecret?: string;
        qrCodeUrl?: string;
      }>('/auth/login', { email, password });

      if (response.data) {
        if (response.data.requiresMfa) {
          setPendingToken(response.data.tempToken || null);
          setStep('mfa_verify');
        } else if (response.data.mfaSetupRequired) {
          setPendingToken(response.data.tempToken || null);
          setMfaSecret(response.data.mfaSecret || '');
          setMfaQrCode(response.data.qrCodeUrl || '');
          setStep('mfa_setup');
        } else {
          await login(email, password);
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    }
  });

  const onSubmitMfaVerify = submitVerify(async ({ code }) => {
    setServerError('');
    try {
      const response = await api.post('/auth/mfa/verify', { tempToken: pendingToken, code });
      if (response.success) {
        const { email, password } = getCreds();
        await login(email, password);
        navigate('/dashboard');
      } else {
        setServerError('Invalid verification code');
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Verification failed');
    }
  });

  const onSubmitMfaSetup = submitSetup(async ({ code }) => {
    setServerError('');
    try {
      const response = await api.post('/auth/mfa/setup', {
        tempToken: pendingToken,
        secret: mfaSecret,
        code,
      });
      if (response.success) {
        const { email, password } = getCreds();
        await login(email, password);
        navigate('/dashboard');
      } else {
        setServerError('Invalid verification code. Please try again.');
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'MFA setup failed');
    }
  });

  const handleSkipMfa = async () => {
    setSkipLoading(true);
    try {
      const { email, password } = getCreds();
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSkipLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <Home className="h-10 w-10 text-white" />
          <span className="text-2xl font-bold text-white">BOSSNYUMBA</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">Property Management Made Intelligent</h1>
          <p className="text-blue-100 text-lg">
            Monitor your portfolio performance, track rent collection, approve maintenance requests, and access detailed financial reports - all in one place.
          </p>
        </div>
        <div className="text-blue-200 text-sm">Trusted by property owners across Tanzania</div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Home className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">BOSSNYUMBA</span>
          </div>

          {step === 'credentials' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
              <p className="text-gray-500 mb-8">Sign in to your owner portal to manage your properties</p>

              {serverError && (
                <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {serverError}
                </div>
              )}

              <form onSubmit={onSubmitCredentials} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                  <input
                    id="email"
                    type="email"
                    aria-invalid={!!credsState.errors.email}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="you@example.com"
                    {...regCreds('email')}
                  />
                  {credsState.errors.email && <p role="alert" className="mt-1 text-xs text-red-600">{credsState.errors.email.message}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    id="password"
                    type="password"
                    aria-invalid={!!credsState.errors.password}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                    {...regCreds('password')}
                  />
                  {credsState.errors.password && <p role="alert" className="mt-1 text-xs text-red-600">{credsState.errors.password.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={credsState.isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {credsState.isSubmitting && <Spinner size="sm" />}
                  Sign in
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-gray-500">
                Don't have an account? <Link to="/register" className="text-blue-600 font-medium hover:underline">Register</Link>
              </p>
            </>
          )}

          {step === 'mfa_verify' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h2>
                  <p className="text-gray-500 text-sm">Enter the code from your authenticator app</p>
                </div>
              </div>

              {serverError && (
                <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {serverError}
                </div>
              )}

              <form onSubmit={onSubmitMfaVerify} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                  <input
                    id="mfaCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    aria-invalid={!!verifyState.errors.code}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest font-mono"
                    placeholder="000000"
                    autoFocus
                    {...regVerify('code')}
                  />
                  {verifyState.errors.code && <p role="alert" className="mt-1 text-xs text-red-600">{verifyState.errors.code.message}</p>}
                </div>

                <button type="submit" disabled={verifyState.isSubmitting} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {verifyState.isSubmitting && <Spinner size="sm" />}
                  Verify
                </button>
              </form>

              <button
                onClick={() => {
                  setStep('credentials');
                  resetVerify({ code: '' });
                  setServerError('');
                }}
                className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Back to login
              </button>
            </>
          )}

          {step === 'mfa_setup' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-green-100 rounded-full">
                  <Smartphone className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Set Up Two-Factor Authentication</h2>
                  <p className="text-gray-500 text-sm">Secure your account with an authenticator app</p>
                </div>
              </div>

              {serverError && (
                <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {serverError}
                </div>
              )}

              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 mb-3">
                    <span className="font-medium">Step 1:</span> Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                  {mfaQrCode ? (
                    <div className="flex justify-center p-4 bg-white rounded-lg border">
                      <img src={mfaQrCode} alt="MFA QR Code" className="w-48 h-48" />
                    </div>
                  ) : (
                    <div className="flex justify-center p-4 bg-white rounded-lg border">
                      <div className="w-48 h-48 bg-gray-200 rounded animate-pulse flex items-center justify-center">
                        <span className="text-gray-500 text-sm">Loading QR...</span>
                      </div>
                    </div>
                  )}
                  {mfaSecret && (
                    <div className="mt-3 p-2 bg-white rounded border">
                      <p className="text-xs text-gray-500 mb-1">Or enter this code manually:</p>
                      <code className="text-sm font-mono text-gray-900 break-all">{mfaSecret}</code>
                    </div>
                  )}
                </div>

                <form onSubmit={onSubmitMfaSetup} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="setupMfaCode" className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="font-medium">Step 2:</span> Enter the 6-digit code from your app
                    </label>
                    <input
                      id="setupMfaCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      aria-invalid={!!setupState.errors.code}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest font-mono"
                      placeholder="000000"
                      {...regSetup('code')}
                    />
                    {setupState.errors.code && <p role="alert" className="mt-1 text-xs text-red-600">{setupState.errors.code.message}</p>}
                  </div>

                  <button type="submit" disabled={setupState.isSubmitting} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {setupState.isSubmitting && <Spinner size="sm" />}
                    <CheckCircle className="h-4 w-4" />
                    Complete Setup
                  </button>
                </form>

                <button
                  onClick={handleSkipMfa}
                  disabled={skipLoading}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                  Skip for now (not recommended)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
