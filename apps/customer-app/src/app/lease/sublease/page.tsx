'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
  Alert,
  AlertDescription,
} from '@bossnyumba/design-system';

const subleaseSchema = z
  .object({
    prospectName: z.string().trim().min(1, 'Prospect name is required'),
    prospectEmail: z.string().trim().email('Please enter a valid email address'),
    prospectPhone: z
      .string()
      .trim()
      .min(1, 'Phone number is required')
      .regex(/^\+?[0-9\s-]{7,}$/, 'Please enter a valid phone number'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    proposedRent: z.coerce.number().positive('Proposed rent must be positive'),
    reason: z.string().trim().min(1, 'Reason is required'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after start date.',
    path: ['endDate'],
  });

type SubleaseForm = z.infer<typeof subleaseSchema>;

export default function SubleaseRequestPage(): React.ReactElement {
  const t = useTranslations('subleasePage');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubleaseForm>({
    resolver: zodResolver(subleaseSchema),
    defaultValues: {
      prospectName: '',
      prospectEmail: '',
      prospectPhone: '',
      startDate: '',
      endDate: '',
      proposedRent: 0,
      reason: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (values) => {
    setFeedback(null);
    try {
      // TODO: wire POST /api/customer/lease/sublease
      const res = await fetch('/api/customer/lease/sublease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setFeedback({ kind: 'success', message: 'Sublease request sent for owner approval.' });
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Submission failed',
      });
    }
  });

  return (
    <main className="p-6 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {feedback && (
              <Alert variant={feedback.kind === 'success' ? 'success' : 'danger'}>
                <AlertDescription>{feedback.message}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="name">{t('prospectName')}</Label>
              <Input id="name" error={!!errors.prospectName} {...register('prospectName')} />
              {errors.prospectName && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.prospectName.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="email">{t('prospectEmail')}</Label>
                <Input id="email" type="email" error={!!errors.prospectEmail} {...register('prospectEmail')} />
                {errors.prospectEmail && (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {errors.prospectEmail.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">{t('prospectPhone')}</Label>
                <Input id="phone" error={!!errors.prospectPhone} {...register('prospectPhone')} />
                {errors.prospectPhone && (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {errors.prospectPhone.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="start">{t('startDate')}</Label>
                <Input id="start" type="date" error={!!errors.startDate} {...register('startDate')} />
                {errors.startDate && (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {errors.startDate.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="end">{t('endDate')}</Label>
                <Input id="end" type="date" error={!!errors.endDate} {...register('endDate')} />
                {errors.endDate && (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {errors.endDate.message}
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="rent">{t('proposedRent')}</Label>
              <Input
                id="rent"
                type="number"
                min={0}
                error={!!errors.proposedRent}
                {...register('proposedRent', { valueAsNumber: true })}
              />
              {errors.proposedRent && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.proposedRent.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="reason">{t('reason')}</Label>
              <textarea
                id="reason"
                className="w-full border rounded-md p-2"
                rows={3}
                aria-invalid={!!errors.reason}
                {...register('reason')}
              />
              {errors.reason && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.reason.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
              aria-label={t('submitRequestAria')}
            >
              {t('submitRequest')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
