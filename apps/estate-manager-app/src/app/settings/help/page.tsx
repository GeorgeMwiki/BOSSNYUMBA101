'use client';

import Link from 'next/link';
import { Mail, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const faqs = [
  { q: 'How do I create a work order?', a: 'Go to Work Orders → New, fill in the details and submit.' },
  { q: 'How do I record a payment?', a: 'Go to Payments → Receive Payment, select the invoice and enter amount.' },
  { q: 'How do I schedule an inspection?', a: 'Go to Inspections → Schedule, select unit, customer, and date.' },
];

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help & Support" showBack />

      <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">FAQs</h2>
          <div className="card divide-y divide-gray-100">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-4">
                <div className="font-medium">{faq.q}</div>
                <div className="text-sm text-gray-500 mt-1">{faq.a}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Contact</h2>
          <div className="card divide-y divide-gray-100">
            <a href="mailto:support@bossnyumba.com" className="p-4 flex items-center gap-3 hover:bg-gray-50">
              <Mail className="w-5 h-5 text-primary-600" />
              <div>
                <div className="font-medium">Email Support</div>
                <div className="text-sm text-gray-500">support@bossnyumba.com</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
