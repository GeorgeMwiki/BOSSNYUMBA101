'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Star } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type WorkOrderRecord } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const ticketId = params.id as string;

  const detailQuery = useQuery<WorkOrderRecord>({
    queryKey: ['work-orders', ticketId],
    queryFn: () => api.workOrders.get(ticketId),
    enabled: !!ticketId,
  });

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [issueNotResolved, setIssueNotResolved] = useState(false);
  const [issueDetails, setIssueDetails] = useState('');

  const displayRating = hoverRating || rating;

  const mutation = useMutation({
    mutationFn: () =>
      api.workOrders.rate(ticketId, {
        rating,
        feedback: feedback || undefined,
        issueResolved: !issueNotResolved,
        issueDetails: issueNotResolved ? issueDetails : undefined,
      }),
    onSuccess: () => {
      toast.success('Thanks for your feedback');
      router.push('/requests?feedback=submitted');
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit feedback',
        'Submission failed'
      ),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    mutation.mutate();
  };

  const wo = detailQuery.data;

  return (
    <>
      <PageHeader title="Rate Service" showBack />
      <form onSubmit={handleSubmit} className="space-y-6 px-4 py-4 pb-8">
        {wo && (
          <div className="card p-4">
            <div className="mb-1 text-xs text-gray-400">
              {wo.workOrderNumber ?? `#${wo.id.slice(0, 8)}`}
            </div>
            <div className="font-medium text-white">{wo.title}</div>
            <div className="text-sm text-gray-400">{wo.category}</div>
          </div>
        )}

        <section>
          <label className="label">How was the service?</label>
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-2 transition-transform hover:scale-110"
              >
                <Star
                  className={`h-10 w-10 transition-colors ${
                    star <= displayRating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-400'
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="text-center text-sm text-gray-400">
            {rating === 0 && 'Tap to rate'}
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent'}
          </div>
        </section>

        <section>
          <label className="label" htmlFor="feedback">
            Additional feedback (optional)
          </label>
          <textarea
            id="feedback"
            className="input min-h-[100px]"
            placeholder="Anything else you'd like to share about the service?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </section>

        <section className="card p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="issueNotResolved"
              className="mt-1 rounded border-gray-300"
              checked={issueNotResolved}
              onChange={(e) => setIssueNotResolved(e.target.checked)}
            />
            <div>
              <label
                htmlFor="issueNotResolved"
                className="flex cursor-pointer items-center gap-2 text-sm font-medium"
              >
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Issue was not fully resolved
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Check this if the problem persists or wasn&apos;t fixed properly
              </p>
            </div>
          </div>

          {issueNotResolved && (
            <div className="mt-4">
              <label className="label" htmlFor="issueDetails">
                Describe what&apos;s still wrong
              </label>
              <textarea
                id="issueDetails"
                className="input min-h-[80px]"
                placeholder="Please describe what still needs to be fixed..."
                value={issueDetails}
                onChange={(e) => setIssueDetails(e.target.value)}
                required
              />
            </div>
          )}
        </section>

        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={rating === 0 || mutation.isPending}
        >
          {mutation.isPending ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>
    </>
  );
}
