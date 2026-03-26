'use client';

import { AlertTriangle, Mail, ChevronRight, HelpCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@bossnyumba/api-client';

interface FAQ {
  q: string;
  a: string;
}

export default function HelpPage() {
  const { data: faqs, isLoading, isError, refetch } = useQuery({
    queryKey: ['help-faqs'],
    queryFn: async () => {
      const response = await getApiClient().get<FAQ[]>('/help/faqs');
      return response.data ?? [];
    },
  });

  return (
    <>
      <PageHeader title="Help & Support" showBack />

      <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">FAQs</h2>
          {isLoading ? (
            <div className="card divide-y divide-gray-100 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 rounded" />
                  <div className="h-3 w-full bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center py-8 text-center">
              <AlertTriangle className="w-8 h-8 text-warning-400 mb-3" />
              <p className="text-sm text-gray-600 mb-3">Could not load FAQs.</p>
              <button onClick={() => refetch()} className="btn-secondary text-sm">Retry</button>
            </div>
          ) : faqs && faqs.length > 0 ? (
            <div className="card divide-y divide-gray-100">
              {faqs.map((faq, idx) => (
                <div key={idx} className="p-4">
                  <div className="font-medium">{faq.q}</div>
                  <div className="text-sm text-gray-500 mt-1">{faq.a}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <HelpCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No FAQs available yet.</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Contact</h2>
          <div className="card divide-y divide-gray-100">
            {process.env.NEXT_PUBLIC_SUPPORT_EMAIL && (
            <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`} className="p-4 flex items-center gap-3 hover:bg-gray-50">
              <Mail className="w-5 h-5 text-primary-600" />
              <div>
                <div className="font-medium">Email Support</div>
                <div className="text-sm text-gray-500">{process.env.NEXT_PUBLIC_SUPPORT_EMAIL}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </a>
          )}
          </div>
        </section>
      </div>
    </>
  );
}
