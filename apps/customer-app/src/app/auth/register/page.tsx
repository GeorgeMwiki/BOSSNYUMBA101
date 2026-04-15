'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, User, Mail, IdCard, Ticket, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';

const PHONE_PATTERN = /^(\+?254|0)?7\d{8}$/;

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    phone: '',
    firstName: '',
    lastName: '',
    email: '',
    nationalId: '',
    inviteCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!PHONE_PATTERN.test(formData.phone.replace(/\s/g, ''))) {
      const msg = 'Enter a valid Kenyan mobile number (e.g. 07XXXXXXXX)';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (formData.nationalId && formData.nationalId.replace(/\D/g, '').length < 6) {
      const msg = 'Please enter a valid national ID number';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        phone: formData.phone,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim() || undefined,
        nationalId: formData.nationalId.trim() || undefined,
        inviteCode: formData.inviteCode.trim() || undefined,
      });

      if (result.success) {
        if (result.requiresOtp) {
          toast.success('Account created — verify your phone to finish.');
          router.push(
            `/auth/otp?phone=${encodeURIComponent(formData.phone)}&mode=register`
          );
        } else {
          toast.success('Welcome to BOSSNYUMBA');
          router.replace('/');
        }
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
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 px-6 py-8 max-w-md mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500 mt-2">
            Register to manage your tenancy. Tenants joining an existing
            property can enter an invite code below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="firstName" className="label">
              First Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, firstName: e.target.value }))
                }
                placeholder="John"
                className="input pl-12"
                required
                autoComplete="given-name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="lastName" className="label">
              Last Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, lastName: e.target.value }))
                }
                placeholder="Kamau"
                className="input pl-12"
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="+254 7XX XXX XXX"
                className="input pl-12"
                required
                autoComplete="tel"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="label">
              Email <span className="text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="john@example.com"
                className="input pl-12"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nationalId" className="label">
              National ID <span className="text-gray-400">(required for KYC)</span>
            </label>
            <div className="relative">
              <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="nationalId"
                type="text"
                inputMode="numeric"
                value={formData.nationalId}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, nationalId: e.target.value }))
                }
                placeholder="12345678"
                className="input pl-12"
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              We use this to verify your identity and generate tenancy documents.
            </p>
          </div>

          <div>
            <label htmlFor="inviteCode" className="label">
              Invite Code <span className="text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="inviteCode"
                type="text"
                value={formData.inviteCode}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    inviteCode: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="e.g. PROP-4829"
                className="input pl-12 uppercase"
                autoComplete="off"
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
            disabled={loading}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/auth/login" className="text-primary-600 font-medium">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
