'use client';

import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const rules = [
  {
    title: 'Quiet Hours',
    content: 'Quiet hours are from 10:00 PM to 7:00 AM. Please keep noise levels low during these times.',
  },
  {
    title: 'Common Areas',
    content: 'Common areas (lobby, hallways, gym, pool) must be kept clean. Furniture and personal items should not be left in common spaces.',
  },
  {
    title: 'Pets',
    content: 'Pets are allowed with prior approval. Please register your pet with management and comply with leash requirements in common areas.',
  },
  {
    title: 'Parking',
    content: 'Each unit has one assigned parking space. Guest parking is available in designated areas. Do not park in fire lanes.',
  },
  {
    title: 'Waste & Recycling',
    content: 'Dispose of waste in designated bins. Recyclables (paper, plastic, glass) go in blue bins. Bulky items require pickup scheduling.',
  },
  {
    title: 'Renovations',
    content: 'Any unit modifications require written approval from management. Construction hours: 8:00 AM–6:00 PM, weekdays only.',
  },
];

export default function PropertyRulesPage() {
  return (
    <>
      <PageHeader title="Property Rules" showBack />

      <div className="px-4 py-4 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-50 rounded-lg">
            <FileText className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="font-semibold">Building Guidelines</h2>
            <p className="text-sm text-gray-500">Please follow these rules for a pleasant community</p>
          </div>
        </div>

        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div key={index} className="card p-4">
              <h3 className="font-medium text-primary-600 mb-2">{rule.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{rule.content}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
