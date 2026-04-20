'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MessageCircle, Shield } from 'lucide-react';
import { Spinner } from '@bossnyumba/design-system';

function WhatsAppRegistrationContent() {
  const t = useTranslations('authWhatsapp');
  const searchParams = useSearchParams();
  
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying');
  const [error, setError] = useState('');
  
  // Extract params from WhatsApp deep link
  const token = searchParams.get('token');
  const phone = searchParams.get('phone');
  const unitId = searchParams.get('unit');
  const propertyId = searchParams.get('property');
  
  useEffect(() => {
    const verifyWhatsAppLink = async () => {
      if (!token || !phone) {
        setStatus('error');
        setError(t('invalidLink'));
        return;
      }
      
      await new Promise((resolve) => setTimeout(resolve, 300));
      setStatus('error');
      setError(t('notWired'));
    };
    
    verifyWhatsAppLink();
  }, [token, phone, unitId, propertyId]);
  
  if (status === 'verifying') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Spinner size="lg" className="text-primary-600" />
          </div>
          <h1 className="text-xl font-semibold mb-2">{t('verifying')}</h1>
          <p className="text-gray-500 text-sm">
            {t('verifyingBody')}
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
          <h1 className="text-xl font-semibold mb-2">{t('verificationFailed')}</h1>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? ''}?text=I%20need%20a%20new%20registration%20link`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            {t('requestNewLink')}
          </a>
        </div>
      </main>
    );
  }
}

function LoadingFallback() {
  const t = useTranslations('authWhatsapp');
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Spinner size="lg" className="text-primary-600" />
        </div>
        <h1 className="text-xl font-semibold mb-2">{t('loading')}</h1>
      </div>
    </main>
  );
}

export default function WhatsAppRegistrationPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WhatsAppRegistrationContent />
    </Suspense>
  );
}
