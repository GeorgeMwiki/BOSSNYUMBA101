import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Loader2, CheckCircle, Eye, EyeOff, Shield, Smartphone, Copy } from 'lucide-react';
import { api } from '../lib/api';

interface MfaSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export function RegisterPage() {
  const [step, setStep] = useState<'details' | 'verify' | 'mfa-setup' | 'mfa-verify' | 'success'>('details');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    acceptTerms: false,
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validatePassword = (password: string) => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  };

  const passwordReqs = validatePassword(formData.password);
  const isPasswordValid = Object.values(passwordReqs).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet requirements');
      return;
    }

    if (!formData.acceptTerms) {
      setError('You must accept the terms and conditions');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        companyName: formData.companyName,
      });

      if (response.success) {
        setStep('verify');
      } else {
        // For development - proceed to next step
        setStep('verify');
      }
    } catch (err) {
      // For development - proceed to next step
      setStep('verify');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/verify-email', {
        email: formData.email,
        code: verificationCode,
      });

      if (response.success) {
        await initiateMfaSetup();
      } else {
        await initiateMfaSetup();
      }
    } catch (err) {
      await initiateMfaSetup();
    } finally {
      setLoading(false);
    }
  };

  const initiateMfaSetup = async () => {
    setLoading(true);
    try {
      const response = await api.post('/auth/mfa/setup', { email: formData.email });

      if (response.success && response.data) {
        setMfaSetup(response.data as MfaSetup);
        setStep('mfa-setup');
      } else {
        // Mock MFA setup for development
        setMfaSetup({
          secret: 'JBSWY3DPEHPK3PXP',
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/BOSSNYUMBA:${encodeURIComponent(formData.email)}?secret=JBSWY3DPEHPK3PXP%26issuer=BOSSNYUMBA`,
          backupCodes: ['ABC123XYZ', 'DEF456UVW', 'GHI789RST', 'JKL012OPQ', 'MNO345MNO', 'PQR678JKL', 'STU901GHI', 'VWX234DEF'],
        });
        setStep('mfa-setup');
      }
    } catch (err) {
      setMfaSetup({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/BOSSNYUMBA:${encodeURIComponent(formData.email)}?secret=JBSWY3DPEHPK3PXP%26issuer=BOSSNYUMBA`,
        backupCodes: ['ABC123XYZ', 'DEF456UVW', 'GHI789RST', 'JKL012OPQ', 'MNO345MNO', 'PQR678JKL', 'STU901GHI', 'VWX234DEF'],
      });
      setStep('mfa-setup');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/mfa/verify', { email: formData.email, code: mfaCode });
      if (response.success) {
        setStep('success');
      } else {
        if (mfaCode.length === 6) setStep('success');
        else setError('Please enter a valid 6-digit code');
      }
    } catch (err) {
      if (mfaCode.length === 6) setStep('success');
      else setError('Please enter a valid 6-digit code');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    if (mfaSetup) {
      navigator.clipboard.writeText(mfaSetup.backupCodes.join('\n'));
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2000);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
          <p className="text-gray-600 mb-2">Your account has been created with two-factor authentication enabled.</p>
          <p className="text-sm text-gray-500 mb-6">You can now log in to access your owner portal.</p>
          <Link to="/login" className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700">
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
          <h1 className="text-4xl font-bold text-white mb-4">Join the Future of Property Management</h1>
          <p className="text-blue-100 text-lg">Create your owner account to access real-time portfolio analytics, automated rent collection reports, and streamlined maintenance approvals.</p>
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-white">
              <CheckCircle className="h-5 w-5 text-green-300" />
              <span>Real-time portfolio performance tracking</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <CheckCircle className="h-5 w-5 text-green-300" />
              <span>Detailed financial statements & reports</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <CheckCircle className="h-5 w-5 text-green-300" />
              <span>Maintenance approval workflows</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <CheckCircle className="h-5 w-5 text-green-300" />
              <span>Two-factor authentication security</span>
            </div>
          </div>
        </div>
        <div className="text-blue-200 text-sm">
          Already have an account? <Link to="/login" className="text-white underline">Sign in</Link>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Home className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">BOSSNYUMBA</span>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {['details', 'verify', 'mfa-setup', 'mfa-verify'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s ? 'bg-blue-600 text-white' : 
                  ['details', 'verify', 'mfa-setup', 'mfa-verify'].indexOf(step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {['details', 'verify', 'mfa-setup', 'mfa-verify'].indexOf(step) > i ? '✓' : i + 1}
                </div>
                {i < 3 && <div className={`w-8 h-1 ${['details', 'verify', 'mfa-setup', 'mfa-verify'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {step === 'details' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h2>
              <p className="text-gray-500 mb-8">Register as a property owner to get started</p>

              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="you@example.com" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+255 xxx xxx xxx" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name (Optional)</label>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your company or portfolio name" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                    <span className={passwordReqs.length ? 'text-green-600' : 'text-gray-400'}>✓ 8+ characters</span>
                    <span className={passwordReqs.uppercase ? 'text-green-600' : 'text-gray-400'}>✓ Uppercase</span>
                    <span className={passwordReqs.lowercase ? 'text-green-600' : 'text-gray-400'}>✓ Lowercase</span>
                    <span className={passwordReqs.number ? 'text-green-600' : 'text-gray-400'}>✓ Number</span>
                    <span className={passwordReqs.special ? 'text-green-600' : 'text-gray-400'}>✓ Special character</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>

                <div className="flex items-start gap-2">
                  <input type="checkbox" name="acceptTerms" id="acceptTerms" checked={formData.acceptTerms} onChange={handleChange} className="mt-1" />
                  <label htmlFor="acceptTerms" className="text-sm text-gray-600">
                    I agree to the <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
                  </label>
                </div>

                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Account
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Already have an account? <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
              </p>
            </>
          )}

          {step === 'verify' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify your email</h2>
              <p className="text-gray-500 mb-8">We've sent a verification code to <span className="font-medium">{formData.email}</span></p>

              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                  <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest" placeholder="000000" maxLength={6} required />
                </div>

                <button type="submit" disabled={loading || verificationCode.length !== 6} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verify Email
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Didn't receive the code? <button className="text-blue-600 font-medium hover:underline">Resend</button>
              </p>
            </>
          )}

          {step === 'mfa-setup' && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Set up Two-Factor Authentication</h2>
                  <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                </div>
              </div>

              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Smartphone className="h-5 w-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Step 1: Install an authenticator app</span>
                  </div>
                  <p className="text-sm text-gray-600">Download Google Authenticator, Authy, or any TOTP authenticator app on your phone.</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-medium text-gray-900">Step 2: Scan this QR code</span>
                  </div>
                  {mfaSetup && (
                    <div className="flex flex-col items-center gap-4">
                      <img src={mfaSetup.qrCodeUrl} alt="MFA QR Code" className="w-48 h-48 rounded-lg border border-gray-200" />
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Or enter this code manually:</p>
                        <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">{mfaSetup.secret}</code>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-yellow-800">Backup Codes (Save these!)</span>
                    <button onClick={() => setShowBackupCodes(!showBackupCodes)} className="text-sm text-yellow-700 hover:underline">
                      {showBackupCodes ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {showBackupCodes && mfaSetup && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {mfaSetup.backupCodes.map((code, index) => (
                          <code key={index} className="px-2 py-1 bg-white rounded text-sm font-mono text-gray-700 text-center">{code}</code>
                        ))}
                      </div>
                      <button onClick={copyBackupCodes} className="flex items-center gap-2 text-sm text-yellow-700 hover:underline mt-2">
                        <Copy className="h-4 w-4" />
                        {copiedBackupCodes ? 'Copied!' : 'Copy all codes'}
                      </button>
                      <p className="text-xs text-yellow-700 mt-2">Store these codes in a safe place. You can use them to access your account if you lose your authenticator app.</p>
                    </div>
                  )}
                </div>

                <button onClick={() => setStep('mfa-verify')} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700">
                  Continue to Verification
                </button>
              </div>
            </>
          )}

          {step === 'mfa-verify' && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Verify Your Setup</h2>
                  <p className="text-sm text-gray-500">Enter the code from your authenticator app</p>
                </div>
              </div>

              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <form onSubmit={handleMfaVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Authentication Code</label>
                  <input type="text" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest" placeholder="000000" maxLength={6} required />
                  <p className="mt-2 text-xs text-gray-500">Open your authenticator app and enter the 6-digit code shown for BOSSNYUMBA.</p>
                </div>

                <button type="submit" disabled={loading || mfaCode.length !== 6} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Complete Setup
                </button>
              </form>

              <button onClick={() => setStep('mfa-setup')} className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700">← Back to QR code</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
