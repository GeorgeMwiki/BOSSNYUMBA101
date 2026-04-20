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

const letterSchema = z
  .object({
    type: z.enum(['proof_of_residence', 'rent_statement', 'no_objection', 'reference', 'custom']),
    recipientName: z.string().trim().min(1, 'Recipient name is required'),
    reason: z.string().trim().min(1, 'Reason is required'),
    customText: z.string().optional().default(''),
  })
  .refine((data) => data.type !== 'custom' || (data.customText ?? '').trim().length > 0, {
    message: 'Custom text is required when letter type is custom',
    path: ['customText'],
  });

type LetterForm = z.infer<typeof letterSchema>;

export default function RequestLetterPage(): React.ReactElement {
  const t = useTranslations('lettersPage');
  const [message, setMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LetterForm>({
    resolver: zodResolver(letterSchema),
    defaultValues: {
      type: 'proof_of_residence',
      recipientName: '',
      reason: '',
      customText: '',
    },
    mode: 'onBlur',
  });

  const selectedType = watch('type');

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    try {
      // TODO: wire /api/customer/requests/letters
      const res = await fetch('/api/customer/requests/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (res.ok) setMessage('Letter request submitted. You will be notified when ready.');
      else setMessage('Submission failed.');
    } catch {
      setMessage('Submission failed.');
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
            {message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="type">{t('letterType')}</Label>
              <select id="type" className="w-full border rounded-md p-2" {...register('type')}>
                <option value="proof_of_residence">{t('proofOfResidence')}</option>
                <option value="rent_statement">{t('rentStatement')}</option>
                <option value="no_objection">{t('noObjection')}</option>
                <option value="reference">{t('reference')}</option>
                <option value="custom">{t('custom')}</option>
              </select>
            </div>

            <div>
              <Label htmlFor="recipient">{t('addressedTo')}</Label>
              <Input id="recipient" error={!!errors.recipientName} {...register('recipientName')} />
              {errors.recipientName && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.recipientName.message}
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

            {selectedType === 'custom' && (
              <div>
                <Label htmlFor="custom">{t('customText')}</Label>
                <textarea
                  id="custom"
                  className="w-full border rounded-md p-2"
                  rows={4}
                  aria-invalid={!!errors.customText}
                  {...register('customText')}
                />
                {errors.customText && (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {errors.customText.message}
                  </p>
                )}
              </div>
            )}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('submitting') : t('submitRequest')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
