import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertCircle, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth, type MfaChallenge } from '../contexts/AuthContext';

type Mode = 'credentials' | 'mfa';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const outcome = await login(email.trim().toLowerCase(), password);
      if (outcome.kind === 'mfa_required') {
        setChallenge(outcome.challenge);
        setMode('mfa');
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!challenge) {
      setError('Session expired. Please sign in again.');
      setMode('credentials');
      return;
    }
    if (mfaCode.trim().length < 4) {
      setError('Enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      await verifyMfa(challenge.challengeId, mfaCode.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const methodLabel = challenge?.method === 'totp'
    ? 'authenticator app'
    : challenge?.method === 'sms'
    ? 'phone'
    : 'email';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Shield className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-white">
          Internal Admin Portal
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          BOSSNYUMBA System Administration
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800 py-8 px-4 shadow-xl shadow-black/20 sm:rounded-xl sm:px-10 border border-slate-700">
          {mode === 'credentials' && (
            <form onSubmit={handleCredentialSubmit} className="space-y-6" noValidate>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="admin@company.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          )}

          {mode === 'mfa' && (
            <form onSubmit={handleMfaSubmit} className="space-y-6" noValidate>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/20 mb-3">
                  <KeyRound className="h-6 w-6 text-violet-300" />
                </div>
                <h3 className="text-lg font-semibold text-white">Two-factor authentication</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Enter the 6-digit code from your {methodLabel}
                  {challenge?.destination ? ` (${challenge.destination})` : ''}.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium text-slate-300">
                  Verification code
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\s+/g, ''))}
                  className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm placeholder-slate-400 text-white text-lg tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="123456"
                  maxLength={8}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setMode('credentials'); setChallenge(null); setMfaCode(''); setError(''); }}
                  className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Verify and continue'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
