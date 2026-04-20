'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton, Alert, AlertDescription } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { unitsService } from '@bossnyumba/api-client';

export default function UnitEditPage() {
  const t = useTranslations('unitForm');
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = (params?.id ?? '') as string;

  const { data, isLoading } = useQuery({
    queryKey: ['unit', id],
    queryFn: () => unitsService.get(id),
    retry: false,
  });

  const unit = data?.data;

  const [formData, setFormData] = useState({
    unitNumber: '',
    floor: 0,
    type: 'one_bedroom',
    status: 'AVAILABLE',
    bedrooms: 1,
    bathrooms: 1,
    squareMeters: '',
    rentAmount: '',
    depositAmount: '',
  });

  useEffect(() => {
    if (unit) {
      setFormData({
        unitNumber: unit.unitNumber ?? '',
        floor: unit.floor ?? 0,
        type: unit.type ?? 'one_bedroom',
        status: unit.status ?? 'AVAILABLE',
        bedrooms: unit.bedrooms ?? 1,
        bathrooms: unit.bathrooms ?? 1,
        squareMeters: unit.squareMeters ? String(unit.squareMeters) : '',
        rentAmount: unit.rentAmount != null ? String(unit.rentAmount) : '',
        depositAmount: unit.depositAmount != null ? String(unit.depositAmount) : '',
      });
    }
  }, [unit]);

  const mutation = useMutation({
    mutationFn: (data: typeof formData) =>
      unitsService.update(id, {
        unitNumber: data.unitNumber,
        floor: data.floor,
        type: data.type,
        status: data.status,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        squareMeters: data.squareMeters ? parseFloat(data.squareMeters) : undefined,
        rentAmount: parseFloat(data.rentAmount) || 0,
        depositAmount: parseFloat(data.depositAmount) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit', id] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      router.push(`/units/${id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading || !unit) {
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
            <label className="label">{t('unitNumber')}</label>
            <input
              type="text"
              className="input"
              value={formData.unitNumber}
              onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">{t('floor')}</label>
            <input
              type="number"
              className="input"
              min={0}
              value={formData.floor ?? ''}
              onChange={(e) =>
                setFormData({ ...formData, floor: parseInt(e.target.value, 10) || 0 })
              }
            />
          </div>

          <div>
            <label className="label">{t('unitType')}</label>
            <select
              className="input"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="studio">{t('typeStudio')}</option>
              <option value="one_bedroom">{t('typeOneBedroom')}</option>
              <option value="two_bedroom">{t('typeTwoBedroom')}</option>
              <option value="three_bedroom">{t('typeThreeBedroom')}</option>
              <option value="four_bedroom_plus">{t('typeFourBedroomPlus')}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('bedrooms')}</label>
              <input
                type="number"
                className="input"
                min={0}
                value={formData.bedrooms}
                onChange={(e) =>
                  setFormData({ ...formData, bedrooms: parseInt(e.target.value, 10) || 0 })
                }
                required
              />
            </div>
            <div>
              <label className="label">{t('bathrooms')}</label>
              <input
                type="number"
                className="input"
                min={0}
                value={formData.bathrooms}
                onChange={(e) =>
                  setFormData({ ...formData, bathrooms: parseInt(e.target.value, 10) || 0 })
                }
                required
              />
            </div>
          </div>

          <div>
            <label className="label">{t('squareMeters')}</label>
            <input
              type="number"
              className="input"
              min={0}
              step={0.01}
              value={formData.squareMeters}
              onChange={(e) => setFormData({ ...formData, squareMeters: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('monthlyRent')}</label>
              <input
                type="number"
                className="input"
                min={0}
                value={formData.rentAmount}
                onChange={(e) => setFormData({ ...formData, rentAmount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">{t('deposit')}</label>
              <input
                type="number"
                className="input"
                min={0}
                value={formData.depositAmount}
                onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">{t('status')}</label>
            <select
              className="input"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="AVAILABLE">{t('statusAvailable')}</option>
              <option value="OCCUPIED">{t('statusOccupied')}</option>
              <option value="MAINTENANCE">{t('statusMaintenance')}</option>
              <option value="RESERVED">{t('statusReserved')}</option>
            </select>
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
          <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
            {mutation.isPending ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </form>
    </>
  );
}
