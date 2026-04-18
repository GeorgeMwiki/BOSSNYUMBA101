'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { customersService } from '@bossnyumba/api-client';

const customerSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Please enter a valid email address'),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\+?[0-9\s-]{7,}$/.test(v), 'Please enter a valid phone number'),
});

type CustomerForm = z.infer<typeof customerSchema>;

export default function CustomerFormPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type: 'INDIVIDUAL',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    },
    mode: 'onBlur',
  });

  const mutation = useMutation({
    mutationFn: (data: CustomerForm) =>
      customersService.create({
        type: data.type,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone && data.phone.length > 0 ? data.phone : 'N/A',
      }),
    onSuccess: (response: { data: { id: string } }) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.push(`/customers/${response.data.id}`);
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
  });

  return (
    <>
      <PageHeader title="Add Customer" showBack />

      <form onSubmit={onSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto" noValidate>
        <div className="card p-4 space-y-4">
          <div>
            <label htmlFor="type" className="label">
              Customer Type
            </label>
            <select id="type" className="input" {...register('type')}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="COMPANY">Company</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="label">
                First Name *
              </label>
              <input
                id="firstName"
                type="text"
                className="input"
                aria-invalid={!!errors.firstName}
                {...register('firstName')}
              />
              {errors.firstName && (
                <p role="alert" className="mt-1 text-xs text-danger-600">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="lastName" className="label">
                Last Name *
              </label>
              <input
                id="lastName"
                type="text"
                className="input"
                aria-invalid={!!errors.lastName}
                {...register('lastName')}
              />
              {errors.lastName && (
                <p role="alert" className="mt-1 text-xs text-danger-600">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="email" className="label">
              Email *
            </label>
            <input
              id="email"
              type="email"
              className="input"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              className="input"
              placeholder="+XXX..."
              aria-invalid={!!errors.phone}
              {...register('phone')}
            />
            {errors.phone && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.phone.message}
              </p>
            )}
          </div>
        </div>

        {mutation.isError && (
          <div role="alert" className="p-3 bg-danger-50 text-danger-600 rounded-lg text-sm">
            {(mutation.error as Error).message}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending ? 'Saving...' : 'Create Customer'}
          </button>
        </div>
      </form>
    </>
  );
}
