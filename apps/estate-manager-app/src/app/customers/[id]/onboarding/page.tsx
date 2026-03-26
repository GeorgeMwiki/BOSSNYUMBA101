'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { customersService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';
import { CheckCircle, Clock, User, FileText, CreditCard, Shield } from 'lucide-react';

const STEPS = [
  { key: 'profile', label: 'Profile Created', icon: User },
  { key: 'documents', label: 'Documents Uploaded', icon: FileText },
  { key: 'verification', label: 'ID Verified', icon: Shield },
  { key: 'lease', label: 'Lease Signed', icon: FileText },
  { key: 'payment', label: 'First Payment', icon: CreditCard },
];

export default function CustomerOnboardingPage() {
  const params = useParams();
  const customerId = params.id as string;

  const { data: customerData, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersService.get(customerId),
    retry: false,
  });

  const customer = customerData?.data as Record<string, unknown> | undefined;

  const getStepStatus = (step: string): 'completed' | 'current' | 'pending' => {
    if (!customer) return 'pending';
    switch (step) {
      case 'profile':
        return customer.id ? 'completed' : 'current';
      case 'documents':
        return customer.verificationStatus === 'verified' || customer.verificationStatus === 'pending' ? 'completed' : customer.id ? 'current' : 'pending';
      case 'verification':
        return customer.verificationStatus === 'verified' ? 'completed' : customer.verificationStatus === 'pending' ? 'current' : 'pending';
      case 'lease':
        return (customer as Record<string, unknown>)?.currentLease ? 'completed' : customer.verificationStatus === 'verified' ? 'current' : 'pending';
      case 'payment':
        return 'pending';
      default:
        return 'pending';
    }
  };

  return (
    <>
      <PageHeader title="Customer Onboarding" showBack />

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {isLoading ? (
          <div className="card p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Customer Info */}
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 rounded-full">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <div className="font-semibold">
                    {String(customer?.firstName ?? '')} {String(customer?.lastName ?? '')}
                  </div>
                  <div className="text-sm text-gray-500">{String(customer?.email ?? '')}</div>
                </div>
              </div>
            </div>

            {/* Onboarding Steps */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Onboarding Progress</h3>
              <div className="space-y-4">
                {STEPS.map((step, idx) => {
                  const status = getStepStatus(step.key);
                  const Icon = step.icon;

                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        status === 'completed' ? 'bg-green-100' :
                        status === 'current' ? 'bg-primary-100' :
                        'bg-gray-100'
                      }`}>
                        {status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : status === 'current' ? (
                          <Clock className="w-5 h-5 text-primary-600" />
                        ) : (
                          <span className="text-sm text-gray-400">{idx + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${
                          status === 'completed' ? 'text-green-700' :
                          status === 'current' ? 'text-primary-700' :
                          'text-gray-400'
                        }`}>
                          {step.label}
                        </div>
                      </div>
                      <Icon className={`w-4 h-4 ${
                        status === 'completed' ? 'text-green-500' :
                        status === 'current' ? 'text-primary-500' :
                        'text-gray-300'
                      }`} />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
