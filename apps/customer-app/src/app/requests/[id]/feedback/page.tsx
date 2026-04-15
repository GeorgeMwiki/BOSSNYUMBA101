'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Star, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [issueNotResolved, setIssueNotResolved] = useState(false);
  const [issueDetails, setIssueDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const displayRating = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/v1/requests/${requestId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          feedback,
          issueNotResolved,
          issueDetails: issueNotResolved ? issueDetails : undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to submit feedback (${response.status})`);
      }
      router.push('/requests?feedback=submitted');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Rate Service" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6 pb-8">
        {/* Request Context */}
        <div className="card p-4 bg-gray-50">
          <div className="text-xs text-gray-500 mb-1">Request</div>
          <div className="font-medium">#{requestId}</div>
        </div>

        {/* Star Rating */}
        <section>
          <label className="label">How was the service?</label>
          <div className="flex gap-2 justify-center py-4">
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
                  className={`w-10 h-10 transition-colors ${
                    star <= displayRating
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="text-center text-sm text-gray-500">
            {rating === 0 && 'Tap to rate'}
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent'}
          </div>
        </section>

        {/* Feedback Comment */}
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

        {/* Issue Not Resolved */}
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
                className="font-medium text-sm cursor-pointer flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-danger-500" />
                Issue was not fully resolved
              </label>
              <p className="text-xs text-gray-500 mt-1">
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
              />
            </div>
          )}
        </section>

        {submitError && (
          <div className="card border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
            {submitError}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={rating === 0 || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>
    </>
  );
}
