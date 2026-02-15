import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Loader2, Shield, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface DemoUser {
  email: string;
  password: string;
  name: string;
  role: string;
}

type LoginStep = 'credentials' | 'mfa_verify' | 'mfa_setup';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [step, setStep] = useState<LoginStep>('credentials');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // Fetch demo users
    api.get<DemoUser[]>('/auth/demo-users').then((response) => {
      if (response.success && response.data) {
        setDemoUsers(response.data);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First, attempt login with credentials
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
          // User has MFA enabled, need to verify
          setPendingToken(response.data.tempToken || null);
          setStep('mfa_verify');
        } else if (response.data.mfaSetupRequired) {
          // MFA setup required for this account
          setPendingToken(response.data.tempToken || null);
          setMfaSecret(response.data.mfaSecret || '');
          setMfaQrCode(response.data.qrCodeUrl || '');
          setStep('mfa_setup');
        } else {
          // No MFA, proceed with login
          await login(email, password);
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/mfa/verify', {
        tempToken: pendingToken,
        code: mfaCode,
      });

      if (response.success) {
        await login(email, password);
        navigate('/dashboard');
      } else {
        setError('Invalid verification code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/mfa/setup', {
        tempToken: pendingToken,
        secret: mfaSecret,
        code: mfaCode,
      });

      if (response.success) {
        await login(email, password);
        navigate('/dashboard');
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipMfa = async () => {
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (user: DemoUser) => {
    setEmail(user.email);
    setPassword(user.password);
    setStep('credentials');
    setMfaCode('');
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
          <h1 className="text-4xl font-bold text-white mb-4">
            Property Management Made Intelligent
          </h1>
          <p className="text-blue-100 text-lg">
            Monitor your portfolio performance, track rent collection, approve
            maintenance requests, and access detailed financial reports - all in
            one place.
          </p>
        </div>
        <div className="text-blue-200 text-sm">
          Trusted by property owners across Tanzania
        </div>
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
              <p className="text-gray-500 mb-8">
                Sign in to your owner portal to manage your properties
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sign in
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-gray-500">
                Don't have an account?{' '}
                <Link to="/register" className="text-blue-600 font-medium hover:underline">
                  Register
                </Link>
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

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleMfaVerify} className="space-y-4">
                <div>
                  <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Code
                  </label>
                  <input
                    id="mfaCode"
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest font-mono"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verify
                </button>
              </form>

              <button
                onClick={() => { setStep('credentials'); setMfaCode(''); setError(''); }}
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

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
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

                <form onSubmit={handleMfaSetup} className="space-y-4">
                  <div>
                    <label htmlFor="setupMfaCode" className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="font-medium">Step 2:</span> Enter the 6-digit code from your app
                    </label>
                    <input
                      id="setupMfaCode"
                      type="text"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest font-mono"
                      placeholder="000000"
                      maxLength={6}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || mfaCode.length !== 6}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    <CheckCircle className="h-4 w-4" />
                    Complete Setup
                  </button>
                </form>

                <button
                  onClick={handleSkipMfa}
                  disabled={loading}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                  Skip for now (not recommended)
                </button>
              </div>
            </>
          )}

          {/* Demo users */}
          {demoUsers.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Demo Accounts
              </h3>
              <div className="space-y-2">
                {demoUsers.map((user) => (
                  <button
                    key={user.email}
                    onClick={() => handleDemoLogin(user)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {user.role}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Click any account above to autofill credentials (password: demo123)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
