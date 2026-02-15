'use client';

import Link from 'next/link';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const feedbackHistory = [
  {
    id: '1',
    type: 'suggestion',
    subject: 'Gym reopening',
    preview: 'Would be great if the gym could reopen soon...',
    date: '2024-02-12',
    status: 'acknowledged',
  },
  {
    id: '2',
    type: 'complaint',
    subject: 'Water pressure',
    preview: 'Water pressure has been low in the mornings...',
    date: '2024-02-08',
    status: 'in_review',
  },
  {
    id: '3',
    type: 'compliment',
    subject: 'Maintenance team',
    preview: 'The maintenance team was very professional...',
    date: '2024-02-01',
    status: 'resolved',
  },
];

const typeLabels: Record<string, string> = {
  suggestion: 'Suggestion',
  complaint: 'Complaint',
  compliment: 'Compliment',
  other: 'Other',
};

const statusLabels: Record<string, string> = {
  acknowledged: 'Acknowledged',
  in_review: 'In Review',
  resolved: 'Resolved',
};

export default function FeedbackHistoryPage() {
  return (
    <>
      <PageHeader title="Feedback History" showBack />

      <div className="px-4 py-4 space-y-4">
        <Link
          href="/feedback"
          className="card p-4 flex items-center justify-between bg-primary-50 border-primary-100 hover:bg-primary-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500 rounded-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium">Submit new feedback</div>
              <div className="text-sm text-gray-600">
                Share your suggestions or report issues
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-primary-600" />
        </Link>

        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Past submissions
          </h3>
          <div className="space-y-3">
            {feedbackHistory.map((item) => (
              <div key={item.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {item.subject || typeLabels[item.type]}
                      </span>
                      <span className="badge-gray">{typeLabels[item.type]}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {item.preview}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{new Date(item.date).toLocaleDateString()}</span>
                      <span className="badge-gray">{statusLabels[item.status]}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {feedbackHistory.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">No feedback yet</h3>
              <p className="text-sm text-gray-500 mt-1">
                Your feedback submissions will appear here
              </p>
              <Link href="/feedback" className="btn-primary mt-4 inline-flex">
                Submit feedback
              </Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
