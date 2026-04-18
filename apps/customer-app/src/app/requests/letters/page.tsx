'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
          <CardTitle>Request a letter</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="type">Letter type</Label>
              <select id="type" className="w-full border rounded-md p-2" {...register('type')}>
                <option value="proof_of_residence">Proof of residence</option>
                <option value="rent_statement">Rent statement</option>
                <option value="no_objection">No-objection letter</option>
                <option value="reference">Reference letter</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <Label htmlFor="recipient">Addressed to</Label>
              <Input id="recipient" error={!!errors.recipientName} {...register('recipientName')} />
              {errors.recipientName && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {errors.recipientName.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
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
                <Label htmlFor="custom">Custom text</Label>
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
              {isSubmitting ? 'Submitting...' : 'Submit request'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
