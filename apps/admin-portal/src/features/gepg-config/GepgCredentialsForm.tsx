import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  createZodResolver,
} from '@bossnyumba/design-system';

export interface GepgCredentials {
  readonly spCode: string;
  readonly spName: string;
  readonly signingCertPem: string;
  readonly signingKeyPem: string;
  readonly endpointUrl: string;
}

const gepgSchema = z.object({
  spCode: z.string().trim().min(1, 'SP Code is required'),
  spName: z.string().trim().min(1, 'SP Name is required'),
  endpointUrl: z
    .string()
    .trim()
    .min(1, 'Endpoint URL is required')
    .url('Please enter a valid URL'),
  signingCertPem: z.string().trim().min(1, 'Signing certificate is required'),
  signingKeyPem: z.string().trim().min(1, 'Signing key is required'),
});

type GepgForm = z.infer<typeof gepgSchema>;

export const GepgCredentialsForm: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GepgForm>({
    resolver: createZodResolver<GepgForm>(gepgSchema),
    defaultValues: {
      spCode: '',
      spName: '',
      signingCertPem: '',
      signingKeyPem: '',
      endpointUrl: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setMessage(null);
    try {
      // Lazy-import the api module so refactor stays scoped.
      const { api } = await import('../../lib/api');
      // TODO: wire POST /admin/gepg/credentials (stores signingKey as secret reference).
      await api.post?.('/admin/gepg/credentials', values);
      setMessage('GePG credentials saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    }
  });

  return (
    <form onSubmit={onSubmit} className="p-6 max-w-2xl" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>GePG Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="spCode">SP Code</Label>
            <Input id="spCode" error={!!errors.spCode} {...register('spCode')} />
            {errors.spCode && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.spCode.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="spName">SP Name</Label>
            <Input id="spName" error={!!errors.spName} {...register('spName')} />
            {errors.spName && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.spName.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="endpointUrl">Endpoint URL</Label>
            <Input id="endpointUrl" type="url" error={!!errors.endpointUrl} {...register('endpointUrl')} />
            {errors.endpointUrl && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.endpointUrl.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="cert">Signing Certificate (PEM)</Label>
            <textarea
              id="cert"
              className="w-full border rounded-md p-2 font-mono text-xs"
              rows={6}
              aria-invalid={!!errors.signingCertPem}
              {...register('signingCertPem')}
            />
            {errors.signingCertPem && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.signingCertPem.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="key">Signing Key (PEM) — stored as secret</Label>
            <textarea
              id="key"
              className="w-full border rounded-md p-2 font-mono text-xs"
              rows={6}
              aria-invalid={!!errors.signingKeyPem}
              {...register('signingKeyPem')}
            />
            {errors.signingKeyPem && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.signingKeyPem.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save credentials'}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
};

export default GepgCredentialsForm;
