'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { customersService } from '@bossnyumba/api-client';

export default function CustomerEditPage() {
  const t = useTranslations('customerForm');
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = (params?.id ?? '') as string;

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.get(id),
    retry: false,
  });

  const customer = data?.data;

  const [formData, setFormData] = useState({
    type: 'INDIVIDUAL',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        type: customer.type ?? 'INDIVIDUAL',
        firstName: customer.firstName ?? '',
        lastName: customer.lastName ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
      });
    }
  }, [customer]);

  const mutation = useMutation({
    mutationFn: (data: typeof formData) =>
      customersService.update(id, {
        type: data.type,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.push(`/customers/${id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading || !customer) {
    return (
      <>
        <PageHeader title={t('editTitle')} showBack />
        <div aria-busy="true" aria-live="polite" className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('editTitle')} showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">{t('customerType')}</label>
            <select
              className="input"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="INDIVIDUAL">{t('typeIndividual')}</option>
              <option value="COMPANY">{t('typeCompany')}</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('firstName')}</label>
              <input
                type="text"
                className="input"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">{t('lastName')}</label>
              <input
                type="text"
                className="input"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">{t('email')}</label>
            <input
              type="email"
              className="input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">{t('phone')}</label>
            <input
              type="tel"
              className="input"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </div>

        {mutation.isError && (
          <div className="p-3 bg-danger-50 text-danger-600 rounded-lg text-sm">
            {(mutation.error as Error).message}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
            {mutation.isPending ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </form>
    </>
  );
}
