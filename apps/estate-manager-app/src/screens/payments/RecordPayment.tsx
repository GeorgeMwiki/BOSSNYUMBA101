'use client';

/**
 * RecordPayment — operator-initiated payment capture.
 *
 * Two real gateway calls (no mocks):
 *   1. POST /payments              create a pending intent (amount + currency
 *                                  + optional customer/lease/description).
 *   2. POST /payments/:id/process  settle it on the chosen channel.
 *
 * For out-of-band channels (cash / bank transfer / cheque / card) the
 * gateway marks the intent `processing` immediately — that is the
 * operator's "record" action. For M-Pesa the gateway initiates a real STK
 * push via the payments-ledger engine (the customer confirms on their
 * phone), which is why a phone number is required for that channel only.
 *
 * On success we route to the payment detail so the operator can confirm
 * the live status.
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { customersService, leasesService } from '@bossnyumba/api-client';
import type { CustomerWithLease } from '@bossnyumba/api-client/customers-types';
import type { LeaseWithDetails } from '@bossnyumba/api-client/leases-types';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROUTES } from '@/lib/routes';
import { TENANT_CURRENCY } from '@/lib/currency';
import { recordPayment as recordPaymentApi } from '@/lib/collections-api';

/** Channels accepted by the gateway PaymentProcessSchema. */
const PAYMENT_CHANNELS = [
  'cash',
  'bank_transfer',
  'mpesa',
  'cheque',
  'card',
] as const;
type PaymentChannelValue = (typeof PAYMENT_CHANNELS)[number];

const recordSchema = z
  .object({
    customerId: z.string().trim().min(1, 'Select a customer'),
    leaseId: z.string().trim().optional(),
    amount: z.coerce.number().positive('Enter an amount greater than zero'),
    currency: z.string().trim().length(3),
    channel: z.enum(PAYMENT_CHANNELS),
    phoneNumber: z.string().trim().optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.channel !== 'mpesa' || (v.phoneNumber?.length ?? 0) >= 9, {
    message: 'A phone number is required for an M-Pesa STK push',
    path: ['phoneNumber'],
  });

type RecordForm = z.infer<typeof recordSchema>;

export function RecordPayment() {
  const t = useTranslations('recordPayment');
  const router = useRouter();
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: ['record-payment', 'customers'],
    queryFn: () => customersService.list({ page: 1, pageSize: 100 }),
    retry: false,
  });
  const customers = useMemo<ReadonlyArray<CustomerWithLease>>(
    () => customersQuery.data?.data ?? [],
    [customersQuery.data],
  );

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecordForm>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      customerId: '',
      leaseId: '',
      amount: undefined,
      currency: TENANT_CURRENCY,
      channel: 'cash',
      phoneNumber: '',
      description: '',
    },
    mode: 'onBlur',
  });

  const selectedCustomerId = watch('customerId');
  const selectedChannel = watch('channel');

  // Leases for the selected customer populate the (optional) allocation
  // dropdown so a receipt can be tied to a specific lease.
  const leasesQuery = useQuery({
    queryKey: ['record-payment', 'leases', selectedCustomerId],
    queryFn: () =>
      leasesService.list({ customerId: selectedCustomerId, page: 1, pageSize: 50 }),
    enabled: selectedCustomerId.length > 0,
    retry: false,
  });
  const leases = useMemo<ReadonlyArray<LeaseWithDetails>>(
    () => leasesQuery.data?.data ?? [],
    [leasesQuery.data],
  );

  const mutation = useMutation({
    mutationFn: (values: RecordForm) => recordPaymentApi(values),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['payments-list-live'] });
      queryClient.invalidateQueries({ queryKey: ['arrears'] });
      router.push(ROUTES.payments.detail(row.id));
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
            <label htmlFor="customerId" className="label">
              {t('customer')}
            </label>
            <select
              id="customerId"
              className="input"
              aria-invalid={!!errors.customerId}
              disabled={customersQuery.isLoading}
              {...register('customerId')}
            >
              <option value="">
                {customersQuery.isLoading ? t('loading') : t('selectCustomer')}
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {`${customer.firstName} ${customer.lastName}`.trim() ||
                    customer.email ||
                    customer.id}
                </option>
              ))}
            </select>
            {errors.customerId && (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                {errors.customerId.message}
              </p>
            )}
            {!customersQuery.isLoading && customers.length === 0 && (
              <p className="mt-1 text-xs text-neutral-500">{t('noCustomers')}</p>
            )}
          </div>

          <div>
            <label htmlFor="leaseId" className="label">
              {t('lease')}
            </label>
            <select
              id="leaseId"
              className="input"
              disabled={selectedCustomerId.length === 0 || leasesQuery.isLoading}
              {...register('leaseId')}
            >
              <option value="">{t('leaseUnallocated')}</option>
              {leases.map((lease) => (
                <option key={lease.id} value={lease.id}>
                  {lease.unit?.unitNumber
                    ? t('leaseOptionUnit', { unit: lease.unit.unitNumber })
                    : lease.id}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="amount" className="label">
                {t('amount')}
              </label>
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="input"
                aria-invalid={!!errors.amount}
                {...register('amount')}
              />
              {errors.amount && (
                <p role="alert" className="mt-1 text-xs text-danger-600">
                  {errors.amount.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="currency" className="label">
                {t('currency')}
              </label>
              <input
                id="currency"
                type="text"
                maxLength={3}
                className="input uppercase"
                aria-invalid={!!errors.currency}
                {...register('currency')}
              />
              {errors.currency && (
                <p role="alert" className="mt-1 text-xs text-danger-600">
                  {t('currencyInvalid')}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="channel" className="label">
              {t('channel')}
            </label>
            <select id="channel" className="input" {...register('channel')}>
              {PAYMENT_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {t(`channel_${channel}` as `channel_${PaymentChannelValue}`)}
                </option>
              ))}
            </select>
          </div>

          {selectedChannel === 'mpesa' && (
            <div>
              <label htmlFor="phoneNumber" className="label">
                {t('phoneNumber')}
              </label>
              <input
                id="phoneNumber"
                type="tel"
                inputMode="tel"
                className="input"
                aria-invalid={!!errors.phoneNumber}
                {...register('phoneNumber')}
              />
              {errors.phoneNumber && (
                <p role="alert" className="mt-1 text-xs text-danger-600">
                  {errors.phoneNumber.message}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="description" className="label">
              {t('description')}
            </label>
            <textarea
              id="description"
              className="input min-h-[80px]"
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
            {isSubmitting || mutation.isPending ? t('recording') : t('record')}
          </button>
        </div>
      </form>
    </>
  );
}
