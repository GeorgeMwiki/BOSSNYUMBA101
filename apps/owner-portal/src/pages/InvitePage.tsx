import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, Loader2, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { api } from '../lib/api';

interface InviteDetails {
  inviteId: string;
  email: string;
  role: string;
  inviterName: string;
  organizationName: string;
  propertyName?: string;
  expiresAt: string;
}

export function InvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [step, setStep] = useState<'loading' | 'details' | 'success' | 'error' | 'expired'>('loading');
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setStep('error');
      setError('Invalid invitation link');
      return;
    }

    // Fetch invite details
    api.get<InviteDetails>(`/auth/invite/${token}`).then((response) => {
      if (response.success && response.data) {
        setInvite(response.data);
        setStep('details');
      } else if (response.error?.code === 'INVITE_EXPIRED') {
        setStep('expired');
      } else {
        setStep('error');
        setError(response.error?.message || 'Invalid invitation');
      }
    });
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/accept-invite', {
        token,
        firstName: formData.firstName,
        lastName: formData.lastName,
        password: formData.password,
      });

      if (response.success) {
        setStep('success');
      } else {
        setError(response.error?.message || 'Failed to accept invitation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-500">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Invitation Expired
          </h2>
          <p className="text-gray-600 mb-6">
            This invitation link has expired. Please contact the person who
            invited you to request a new invitation.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Invalid Invitation
          </h2>
          <p className="text-gray-600 mb-6">
            {error || 'This invitation link is invalid or has already been used.'}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to {invite?.organizationName}!
          </h2>
          <p className="text-gray-600 mb-6">
            Your account has been created successfully. You can now sign in to
            access the owner portal.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700"
          >
            Sign in to your account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <Home className="h-10 w-10 text-white" />
          <span className="text-2xl font-bold text-white">BOSSNYUMBA</span>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-white/10 rounded-lg">
              <Users className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            You've Been Invited!
          </h1>
          <p className="text-blue-100 text-lg">
            {invite?.inviterName} has invited you to join{' '}
            <span className="font-medium">{invite?.organizationName}</span> as a{' '}
            <span className="font-medium">{invite?.role?.replace('_', ' ')}</span>.
          </p>
          {invite?.propertyName && (
            <p className="text-blue-100 mt-4">
              You will have access to: <span className="font-medium">{invite.propertyName}</span>
            </p>
          )}
        </div>
        <div className="text-blue-200 text-sm">
          By joining, you agree to our Terms of Service
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Home className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">BOSSNYUMBA</span>
          </div>

          <div className="lg:hidden mb-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">{invite?.inviterName}</span> has
              invited you to join{' '}
              <span className="font-medium">{invite?.organizationName}</span>
            </p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Accept Invitation
          </h2>
          <p className="text-gray-500 mb-8">
            Complete your profile to join as a co-owner
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={invite?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Create Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min. 8 characters"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Accept & Create Account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-blue-600 font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
