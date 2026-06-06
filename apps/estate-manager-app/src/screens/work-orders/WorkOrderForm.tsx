'use client';

/**
 * WorkOrderForm — create a maintenance request.
 *
 * Posts to the real `POST /maintenance/requests` lifecycle endpoint with
 * live property + unit inventory (no mock data). The request is the
 * operator's entry point; it is then dispatched and completed from the
 * detail screen. The DB requires a property and a category enum value, so
 * those are required fields.
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { propertiesService, unitsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROUTES } from '@/lib/routes';
import {
  createMaintenanceRequest,
  type MaintenancePriority,
} from '@/lib/maintenance-api';

const CATEGORIES = [
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'structural',
  'pest_control',
  'landscaping',
  'cleaning',
  'security',
  'other',
] as const;

const PRIORITIES = ['low', 'medium', 'high', 'urgent', 'emergency'] as const;

const formSchema = z.object({
  propertyId: z.string().trim().min(1, 'Select a property'),
  unitId: z.string().trim().optional(),
  title: z.string().trim().min(1, 'A title is required').max(200),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  location: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
});

type WorkOrderFormValues = z.infer<typeof formSchema>;

interface PropertyOption {
  readonly id: string;
  readonly name?: string;
}
interface UnitOption {
  readonly id: string;
  readonly unitNumber?: string;
}

export default function WorkOrderForm() {
  const t = useTranslations('workOrderForm');
  const router = useRouter();
  const queryClient = useQueryClient();

  const propertiesQuery = useQuery({
    queryKey: ['work-order-form', 'properties'],
    queryFn: () => propertiesService.list({ page: 1, pageSize: 100 }),
    retry: false,
  });
  const properties = useMemo<ReadonlyArray<PropertyOption>>(
    () => (propertiesQuery.data?.data ?? []) as ReadonlyArray<PropertyOption>,
    [propertiesQuery.data],
  );

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WorkOrderFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyId: '',
      unitId: '',
      title: '',
      category: 'other',
      priority: 'medium',
      location: '',
      description: '',
    },
    mode: 'onBlur',
  });

  const selectedPropertyId = watch('propertyId');

  const unitsQuery = useQuery({
    queryKey: ['work-order-form', 'units', selectedPropertyId],
    queryFn: () =>
      unitsService.list({ propertyId: selectedPropertyId, page: 1, pageSize: 100 }),
    enabled: selectedPropertyId.length > 0,
    retry: false,
  });
  const units = useMemo<ReadonlyArray<UnitOption>>(
    () => (unitsQuery.data?.data ?? []) as ReadonlyArray<UnitOption>,
    [unitsQuery.data],
  );

  const mutation = useMutation({
    mutationFn: (values: WorkOrderFormValues) =>
      createMaintenanceRequest({
        propertyId: values.propertyId,
        unitId: values.unitId,
        title: values.title,
        category: values.category,
        priority: values.priority as MaintenancePriority,
        location: values.location,
        description: values.description,
      }),
    onSuccess: (req) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      router.push(ROUTES.workOrders.detail(req.id));
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : t('genericError'),
      });
    }
  });

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <form
        onSubmit={onSubmit}
        className="max-w-2xl mx-auto px-4 py-4 space-y-4"
        noValidate
      >
        <div className="card p-4 space-y-4">
          <div>
            <label htmlFor="propertyId" className="label">
              {t('property')}
            </label>
            <select
              id="propertyId"
              className="input"
              aria-invalid={!!errors.propertyId}
              disabled={propertiesQuery.isLoading}
              {...register('propertyId')}
            >
              <option value="">
                {propertiesQuery.isLoading ? t('loading') : t('selectProperty')}
              </option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                </option>
              ))}
            </select>
            {errors.propertyId && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.propertyId.message}
              </p>
            )}
            {!propertiesQuery.isLoading && properties.length === 0 && (
              <p className="mt-1 text-xs text-neutral-500">{t('noProperties')}</p>
            )}
          </div>

          <div>
            <label htmlFor="unitId" className="label">
              {t('unit')}
            </label>
            <select
              id="unitId"
              className="input"
              disabled={selectedPropertyId.length === 0 || unitsQuery.isLoading}
              {...register('unitId')}
            >
              <option value="">{t('unitNone')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber || u.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="title" className="label">
              {t('titleField')}
            </label>
            <input
              id="title"
              type="text"
              className="input"
              aria-invalid={!!errors.title}
              {...register('title')}
            />
            {errors.title && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="label">
                {t('category')}
              </label>
              <select id="category" className="input" {...register('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`category_${c}` as `category_${(typeof CATEGORIES)[number]}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="priority" className="label">
                {t('priority')}
              </label>
              <select id="priority" className="input" {...register('priority')}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`priority_${p}` as `priority_${(typeof PRIORITIES)[number]}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="location" className="label">
              {t('location')}
            </label>
            <input
              id="location"
              type="text"
              className="input"
              placeholder={t('locationPlaceholder')}
              {...register('location')}
            />
          </div>

          <div>
            <label htmlFor="description" className="label">
              {t('description')}
            </label>
            <textarea
              id="description"
              className="input min-h-[100px]"
              placeholder={t('descriptionPlaceholder')}
              {...register('description')}
            />
          </div>
        </div>

        {errors.root && (
          <div
            role="alert"
            className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm text-danger-600"
          >
            {errors.root.message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary flex-1"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={isSubmitting || mutation.isPending}
          >
            {isSubmitting || mutation.isPending ? t('creating') : t('create')}
          </button>
        </div>
      </form>
    </>
  );
}
