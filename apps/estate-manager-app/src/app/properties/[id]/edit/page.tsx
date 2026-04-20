'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Skeleton, Alert, AlertDescription } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { propertiesService } from '@bossnyumba/api-client';

const propertySchema = z.object({
  name: z.string().trim().min(1, 'Property name is required'),
  type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'MIXED']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'UNDER_CONSTRUCTION']),
  address: z.object({
    line1: z.string().trim().min(1, 'Address line 1 is required'),
    city: z.string().trim().min(1, 'City is required'),
    region: z.string().trim(),
    country: z.string().trim().min(1, 'Country is required'),
  }),
  description: z.string(),
  totalUnits: z.coerce.number().int('Must be a whole number').min(0, 'Cannot be negative'),
});

type PropertyForm = z.infer<typeof propertySchema>;

export default function PropertyEditPage() {
  const t = useTranslations('propertyForm');
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = (params?.id ?? '') as string;

  const { data, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesService.get(id),
    retry: false,
  });

  const property = data?.data;
  const defaultCountry = process.env.NEXT_PUBLIC_TENANT_COUNTRY?.trim() || '';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PropertyForm>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: '',
      type: 'RESIDENTIAL',
      status: 'ACTIVE',
      address: { line1: '', city: '', region: '', country: defaultCountry },
      description: '',
      totalUnits: 0,
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (property) {
      reset({
        name: property.name ?? '',
        type: (property.type as PropertyForm['type']) ?? 'RESIDENTIAL',
        status: (property.status as PropertyForm['status']) ?? 'ACTIVE',
        address: {
          line1: property.address?.line1 ?? '',
          city: property.address?.city ?? '',
          region: property.address?.region ?? '',
          country: property.address?.country ?? defaultCountry,
        },
        description: property.description ?? '',
        totalUnits: property.totalUnits ?? 0,
      });
    }
  }, [property, reset, defaultCountry]);

  const mutation = useMutation({
    mutationFn: (values: PropertyForm) =>
      propertiesService.update(id, {
        name: values.name,
        type: values.type,
        status: values.status,
        address: {
          line1: values.address.line1,
          city: values.address.city,
          region: values.address.region || undefined,
          country: values.address.country,
        },
        description: values.description || undefined,
        totalUnits: values.totalUnits,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      router.push(`/properties/${id}`);
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
  });

  if (isLoading || !property) {
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

      <form onSubmit={onSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto" noValidate>
        <div className="card p-4 space-y-4">
          <div>
            <label htmlFor="name" className="label">{t('propertyName')}</label>
            <input id="name" type="text" className="input" aria-invalid={!!errors.name} {...register('name')} />
            {errors.name && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="type" className="label">{t('type')}</label>
              <select id="type" className="input" {...register('type')}>
                <option value="RESIDENTIAL">{t('typeResidential')}</option>
                <option value="COMMERCIAL">{t('typeCommercial')}</option>
                <option value="MIXED">{t('typeMixed')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="status" className="label">{t('status')}</label>
              <select id="status" className="input" {...register('status')}>
                <option value="ACTIVE">{t('statusActive')}</option>
                <option value="INACTIVE">{t('statusInactive')}</option>
                <option value="UNDER_CONSTRUCTION">{t('statusUnderConstruction')}</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="addr-line1" className="label">{t('addressLine1')}</label>
            <input id="addr-line1" type="text" className="input" aria-invalid={!!errors.address?.line1} {...register('address.line1')} />
            {errors.address?.line1 && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.address.line1.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="addr-city" className="label">{t('city')}</label>
              <input id="addr-city" type="text" className="input" aria-invalid={!!errors.address?.city} {...register('address.city')} />
              {errors.address?.city && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.address.city.message}</p>}
            </div>
            <div>
              <label htmlFor="addr-region" className="label">{t('region')}</label>
              <input id="addr-region" type="text" className="input" {...register('address.region')} />
            </div>
          </div>

          <div>
            <label htmlFor="totalUnits" className="label">{t('totalUnits')}</label>
            <input id="totalUnits" type="number" min={0} className="input" aria-invalid={!!errors.totalUnits} {...register('totalUnits', { valueAsNumber: true })} />
            {errors.totalUnits && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.totalUnits.message}</p>}
          </div>

          <div>
            <label htmlFor="description" className="label">{t('description')}</label>
            <textarea id="description" className="input min-h-[100px]" {...register('description')} />
          </div>
        </div>

        {mutation.isError && (
          <Alert variant="danger">
            <AlertDescription>{(mutation.error as Error).message}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </form>
    </>
  );
}
