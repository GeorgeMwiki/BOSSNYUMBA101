'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessageCircle, Shield, Loader2 } from 'lucide-react';
import { getApiClient, initializeApiClient, hasApiClient, useMutation } from '@bossnyumba/api-client';

function WhatsAppRegistrationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  // Extract params from WhatsApp deep link
  const token = searchParams.get('token');
  const phone = searchParams.get('phone');
  const unitId = searchParams.get('unit');
  const propertyId = searchParams.get('property');

  const verifyMutation = useMutation<
    Record<string, unknown>,
    { token: string; phone: string; unitId: string | null; propertyId: string | null }
  >(
    (client, variables) => client.post('/auth/whatsapp/verify', variables),
    {
      onSuccess: (data) => {
        if (data.accessToken) {
          localStorage.setItem('customer_token', data.accessToken as string);
          if (data.user) {
            localStorage.setItem('customer_user', JSON.stringify(data.user));
          }
        }
        setStatus('success');
        router.push('/');
      },
      onError: (err) => {
        setStatus('error');
        setError(err.message || 'Verification failed. Please request a new link from your property manager.');
      },
    }
  );

  useEffect(() => {
    if (!token || !phone) {
      setStatus('error');
      setError('Invalid registration link. Please request a new link from your property manager.');
      return;
    }

    if (!hasApiClient()) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1';
      initializeApiClient({
        baseUrl: apiUrl.endsWith('/api/v1') ? apiUrl : `${apiUrl}/api/v1`,
        timeout: 15000,
      });
    }

    verifyMutation.mutate({ token, phone, unitId, propertyId });
  }, [token, phone, unitId, propertyId]);
  
  if (status === 'verifying') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Verifying Your Link</h1>
          <p className="text-gray-500 text-sm">
            Please wait while we verify your registration link...
          </p>
        </div>
      </main>
    );
  }
  
  if (status === 'success') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-success-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-success-600" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Verified Successfully</h1>
          <p className="text-gray-500 text-sm">
            Your WhatsApp number has been verified. Redirecting...
          </p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-danger-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-danger-600" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Verification Failed</h1>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? ''}?text=I%20need%20a%20new%20registration%20link`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Request New Link
          </a>
        </div>
      </main>
    );
  }
}

export default function WhatsAppRegistrationPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Loading...</h1>
        </div>
      </main>
    }>
      <WhatsAppRegistrationContent />
    </Suspense>
  );
}
