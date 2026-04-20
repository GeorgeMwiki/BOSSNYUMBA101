'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Phone, User, Mail, ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^\+?[0-9\s-]{7,}$/, 'Please enter a valid phone number'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const t = useTranslations('authRegister');
  const router = useRouter();
  const { register: doRegister } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', phone: '', email: '' },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await doRegister({
        phone: values.phone,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email && values.email.length > 0 ? values.email : undefined,
      });

      if (result.success) {
        router.push(`/auth/otp?phone=${encodeURIComponent(values.phone)}&mode=register`);
      } else {
        setError('root', { message: result.message ?? 'Something went wrong' });
      }
    } catch {
      setError('root', { message: 'Something went wrong. Please try again.' });
    }
  });

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 px-6 py-8 max-w-md mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 mt-2">{t('subtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="firstName" className="label">
              First Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="firstName"
                type="text"
                placeholder={t('firstNamePlaceholder')}
                aria-invalid={!!errors.firstName}
                className="input pl-12"
                {...register('firstName')}
              />
            </div>
            {errors.firstName && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.firstName.message}
              </p>
            )}
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
                placeholder={t('lastNamePlaceholder')}
                aria-invalid={!!errors.lastName}
                className="input pl-12"
                {...register('lastName')}
              />
            </div>
            {errors.lastName && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.lastName.message}
              </p>
            )}
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
                placeholder="+XXX XXX XXX XXX"
                autoComplete="tel"
                aria-invalid={!!errors.phone}
                className="input pl-12"
                {...register('phone')}
              />
            </div>
            {errors.phone && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.phone.message}
              </p>
            )}
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
                placeholder="john@example.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                className="input pl-12"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.email.message}
              </p>
            )}
          </div>

          {errors.root && (
            <div role="alert" className="p-3 rounded-xl bg-danger-50 text-danger-600 text-sm">
              {errors.root.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
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
