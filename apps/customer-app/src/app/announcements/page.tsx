'use client';

import Link from 'next/link';
import { Bell, ChevronRight, Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const announcements = [
  {
    id: '1',
    title: 'Water Shut-off Scheduled',
    summary: 'Water will be shut off on Feb 20 from 8am to 12pm for pipe repairs.',
    date: '2024-02-10',
    priority: 'high',
    read: false,
  },
  {
    id: '2',
    title: 'Elevator Maintenance',
    summary: 'Elevator B will be under maintenance Feb 15–16. Use Elevator A.',
    date: '2024-02-08',
    priority: 'medium',
    read: true,
  },
  {
    id: '3',
    title: 'New Security Hours',
    summary: '24/7 security is now active. Report any concerns to the guard desk.',
    date: '2024-02-01',
    priority: 'info',
    read: true,
  },
];

export default function AnnouncementsPage() {
  return (
    <>
      <PageHeader title="Announcements" showBack />

      <div className="px-4 py-4 space-y-4">
        <p className="text-sm text-gray-500 mb-4">
          Property updates and notices from management.
        </p>
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Link
              key={ann.id}
              href={`/announcements/${ann.id}`}
              className="card p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors"
            >
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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{ann.title}</h3>
                  {!ann.read && (
                    <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                  {ann.summary}
                </p>
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(ann.date).toLocaleDateString()}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            </Link>
          ))}
        </div>
        {announcements.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No announcements</h3>
            <p className="text-sm text-gray-500 mt-1">
              Check back later for property updates
            </p>
          </div>
        )}
      </div>
    </>
  );
}
