'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageCircle, CheckCircle, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function WhatsAppRegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
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
        setError('Invalid registration link. Please request a new link from your property manager.');
        return;
      }
      
      try {
        // Simulate API verification - in production would verify token with backend
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        // Simulate successful verification
        const success = token.length > 8; // Simple validation for demo
        
        if (success) {
          // Store pre-filled data for onboarding
          localStorage.setItem('whatsapp_registration', JSON.stringify({
            phone,
            unitId,
            propertyId,
            token,
            verifiedAt: new Date().toISOString(),
          }));
          
          setStatus('success');
        } else {
          setStatus('error');
          setError('This registration link has expired or is invalid.');
        }
      } catch {
        setStatus('error');
        setError('Unable to verify your registration link. Please try again.');
      }
    };
    
    verifyWhatsAppLink();
  }, [token, phone, unitId, propertyId]);
  
  const handleContinue = async () => {
    // Auto-login with verified phone and redirect to complete registration
    const result = await login(phone!, 'whatsapp-verified');
    if (result.success) {
      router.push('/onboarding');
    } else {
      // Redirect to register with pre-filled phone
      router.push(`/auth/register?phone=${encodeURIComponent(phone!)}`);
    }
  };
  
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
            href="https://wa.me/254700123456?text=I%20need%20a%20new%20registration%20link"
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
  
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Success Header */}
      <header className="bg-gradient-to-br from-success-500 to-success-600 text-white px-4 pt-12 pb-16 text-center">
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Verified!</h1>
        <p className="text-success-100">
          Your WhatsApp has been verified successfully.
        </p>
      </header>
      
      <div className="px-4 -mt-8 pb-8 max-w-md mx-auto">
        <div className="card p-5 shadow-lg">
          <h2 className="font-semibold text-lg mb-4">Registration Details</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <MessageCircle className="w-5 h-5 text-success-600" />
              <div>
                <div className="text-sm text-gray-500">Phone Number</div>
                <div className="font-medium">{phone}</div>
              </div>
            </div>
            
            {unitId && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Shield className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="text-sm text-gray-500">Assigned Unit</div>
                  <div className="font-medium">Unit {unitId}</div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 p-4 bg-primary-50 rounded-xl">
            <p className="text-sm text-primary-800">
              <strong>Next Steps:</strong> Complete your registration by providing additional details and uploading required documents.
            </p>
          </div>
        </div>
        
        <button
          onClick={handleContinue}
          className="btn-primary w-full py-4 text-base font-semibold mt-6 flex items-center justify-center gap-2"
        >
          Continue Registration
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </main>
  );
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
