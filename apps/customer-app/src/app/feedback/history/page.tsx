'use client';

import Link from 'next/link';
import { MessageSquare, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@bossnyumba/api-client';

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

function FeedbackHistorySkeleton() {
  return (
    <div className="px-4 py-4 space-y-4 animate-pulse">
      <div className="h-16 bg-gray-200 rounded-xl" />
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 space-y-2">
            <div className="h-4 w-40 bg-gray-200 rounded" />
            <div className="h-3 w-60 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FeedbackHistoryPage() {
  const { data: feedbackHistory, isLoading, isError, refetch } = useQuery<any[]>('/feedback/history');

  return (
    <>
      <PageHeader title="Feedback History" showBack />

      {isLoading ? (
        <FeedbackHistorySkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Failed to load feedback history</h2>
          <p className="text-gray-500 text-sm mb-6">Could not load your feedback submissions.</p>
          <button onClick={() => refetch()} className="btn-primary px-6 py-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : (
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
            {feedbackHistory && feedbackHistory.length > 0 ? (
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
            ) : (
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
      )}
    </>
  );
}
