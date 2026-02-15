'use client';

import { useParams } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const announcements: Record<
  string,
  { title: string; summary: string; body: string; date: string; priority: string }
> = {
  '1': {
    title: 'Water Shut-off Scheduled',
    summary: 'Water will be shut off on Feb 20 from 8am to 12pm for pipe repairs.',
    body: 'Dear Residents,\n\nWe would like to inform you that scheduled maintenance on the building\'s plumbing system will require a temporary water shut-off on Wednesday, February 20, 2024, from 8:00 AM to 12:00 PM.\n\nPlease store water in advance for drinking and other essential use during this period. We apologize for any inconvenience and thank you for your understanding.\n\nIf you have any questions, please contact the property management office.',
    date: '2024-02-10',
    priority: 'high',
  },
  '2': {
    title: 'Elevator Maintenance',
    summary: 'Elevator B will be under maintenance Feb 15–16. Use Elevator A.',
    body: 'Elevator B will be undergoing scheduled maintenance from February 15 to February 16, 2024. During this time, please use Elevator A for access to all floors.\n\nWe expect the maintenance to be completed by end of day February 16. Thank you for your patience.',
    date: '2024-02-08',
    priority: 'medium',
  },
  '3': {
    title: 'New Security Hours',
    summary: '24/7 security is now active. Report any concerns to the guard desk.',
    body: 'We are pleased to announce that 24/7 security coverage is now active at the property. Our security team is available around the clock to assist with any concerns.\n\nPlease report any suspicious activity or safety issues to the guard desk or call the emergency line. Your safety is our priority.',
    date: '2024-02-01',
    priority: 'info',
  },
};

export default function AnnouncementDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const ann = announcements[id];

  if (!ann) {
    return (
      <>
        <PageHeader title="Announcement" showBack />
        <div className="p-4">
          <p className="text-gray-500">Announcement not found.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={ann.title} showBack />
      <div className="px-4 py-4 space-y-4">
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg flex-shrink-0 ${
                ann.priority === 'high'
                  ? 'bg-warning-50'
                  : ann.priority === 'medium'
                  ? 'bg-primary-50'
                  : 'bg-gray-100'
              }`}
            >
              <Megaphone
                className={`w-5 h-5 ${
                  ann.priority === 'high'
                    ? 'text-warning-600'
                    : ann.priority === 'medium'
                    ? 'text-primary-600'
                    : 'text-gray-600'
                }`}
              />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-2">
                {new Date(ann.date).toLocaleDateString()}
              </div>
              <h2 className="font-semibold text-lg mb-3">{ann.title}</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                {ann.body}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
