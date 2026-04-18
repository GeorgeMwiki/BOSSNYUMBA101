'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { unitsService, propertiesService } from '@bossnyumba/api-client';

const unitSchema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
  unitNumber: z.string().trim().min(1, 'Unit number is required'),
  floor: z.coerce.number().int('Must be a whole number').min(0, 'Cannot be negative'),
  type: z.enum(['studio', 'one_bedroom', 'two_bedroom', 'three_bedroom', 'four_bedroom_plus']),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED']),
  bedrooms: z.coerce.number().int().min(0, 'Cannot be negative'),
  bathrooms: z.coerce.number().int().min(0, 'Cannot be negative'),
  squareMeters: z
    .string()
    .refine((v) => !v || !Number.isNaN(parseFloat(v)), 'Must be a number'),
  rentAmount: z
    .string()
    .min(1, 'Rent amount is required')
    .refine((v) => !Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Must be a non-negative number'),
  depositAmount: z
    .string()
    .refine((v) => !v || (!Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0), 'Must be a non-negative number'),
});

type UnitForm = z.infer<typeof unitSchema>;

function UnitFormPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const propertyIdParam = searchParams?.get('propertyId') ?? null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UnitForm>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      propertyId: propertyIdParam ?? '',
      unitNumber: '',
      floor: 0,
      type: 'one_bedroom',
      status: 'AVAILABLE',
      bedrooms: 1,
      bathrooms: 1,
      squareMeters: '',
      rentAmount: '',
      depositAmount: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (propertyIdParam) reset((prev) => ({ ...prev, propertyId: propertyIdParam }));
  }, [propertyIdParam, reset]);

  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesService.list({ pageSize: 100 }),
    retry: false,
  });

  const properties = propertiesData?.data ?? [];

  const mutation = useMutation({
    mutationFn: (data: UnitForm) =>
      unitsService.create({
        propertyId: data.propertyId,
        unitNumber: data.unitNumber,
        floor: data.floor,
        type: data.type,
        status: data.status,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        squareMeters: data.squareMeters ? parseFloat(data.squareMeters) : undefined,
        rentAmount: parseFloat(data.rentAmount) || 0,
        depositAmount: data.depositAmount ? parseFloat(data.depositAmount) || 0 : 0,
      }),
    onSuccess: (response: { data: { id: string } }) => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      router.push(`/units/${response.data.id}`);
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
  });

  return (
    <>
      <PageHeader title="Add Unit" showBack />

      <form onSubmit={onSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto" noValidate>
        <div className="card p-4 space-y-4">
          <div>
            <label htmlFor="propertyId" className="label">Property *</label>
            <select id="propertyId" className="input" aria-invalid={!!errors.propertyId} {...register('propertyId')}>
              <option value="">Select property</option>
              {properties.map((p: { id: string; name: string }) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.propertyId && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.propertyId.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="unitNumber" className="label">Unit Number *</label>
              <input id="unitNumber" type="text" className="input" placeholder="e.g. A101" aria-invalid={!!errors.unitNumber} {...register('unitNumber')} />
              {errors.unitNumber && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.unitNumber.message}</p>}
            </div>
            <div>
              <label htmlFor="floor" className="label">Floor</label>
              <input id="floor" type="number" min={0} className="input" aria-invalid={!!errors.floor} {...register('floor', { valueAsNumber: true })} />
              {errors.floor && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.floor.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="type" className="label">Unit Type</label>
            <select id="type" className="input" {...register('type')}>
              <option value="studio">Studio</option>
              <option value="one_bedroom">1 Bedroom</option>
              <option value="two_bedroom">2 Bedroom</option>
              <option value="three_bedroom">3 Bedroom</option>
              <option value="four_bedroom_plus">4+ Bedroom</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bedrooms" className="label">Bedrooms *</label>
              <input id="bedrooms" type="number" min={0} className="input" aria-invalid={!!errors.bedrooms} {...register('bedrooms', { valueAsNumber: true })} />
              {errors.bedrooms && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.bedrooms.message}</p>}
            </div>
            <div>
              <label htmlFor="bathrooms" className="label">Bathrooms *</label>
              <input id="bathrooms" type="number" min={0} className="input" aria-invalid={!!errors.bathrooms} {...register('bathrooms', { valueAsNumber: true })} />
              {errors.bathrooms && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.bathrooms.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="squareMeters" className="label">Square Meters</label>
            <input id="squareMeters" type="number" min={0} step={0.01} className="input" aria-invalid={!!errors.squareMeters} {...register('squareMeters')} />
            {errors.squareMeters && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.squareMeters.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rentAmount" className="label">Monthly Rent (KES) *</label>
              <input id="rentAmount" type="number" min={0} className="input" aria-invalid={!!errors.rentAmount} {...register('rentAmount')} />
              {errors.rentAmount && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.rentAmount.message}</p>}
            </div>
            <div>
              <label htmlFor="depositAmount" className="label">Deposit (KES)</label>
              <input id="depositAmount" type="number" min={0} className="input" aria-invalid={!!errors.depositAmount} {...register('depositAmount')} />
              {errors.depositAmount && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.depositAmount.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="status" className="label">Status</label>
            <select id="status" className="input" {...register('status')}>
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="RESERVED">Reserved</option>
            </select>
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
            {isSubmitting || mutation.isPending ? 'Saving...' : 'Create Unit'}
          </button>
        </div>
      </form>
    </>
  );
}

export default function UnitFormPage() {
  return (
    <Suspense fallback={<PageHeader title="New Unit" showBack />}>
      <UnitFormPageInner />
    </Suspense>
  );
}
