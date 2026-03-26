'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Star, AlertTriangle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { workOrdersService, feedbackService } from '@bossnyumba/api-client';

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workOrder, setWorkOrder] = useState<{
    id: string;
    workOrderNumber: string;
    title: string;
    category: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [issueNotResolved, setIssueNotResolved] = useState(false);
  const [issueDetails, setIssueDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayRating = hoverRating || rating;

  useEffect(() => {
    async function loadWorkOrder() {
      try {
        const response = await workOrdersService.get(id);
        const wo = response.data;
        setWorkOrder({
          id: wo.id,
          workOrderNumber: (wo as Record<string, unknown>).workOrderNumber as string ?? wo.id,
          title: wo.title,
          category: wo.category,
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load work order');
      } finally {
        setLoading(false);
      }
    }
    loadWorkOrder();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await feedbackService.create({
        type: issueNotResolved ? 'COMPLAINT' : 'GENERAL',
        subject: `Feedback for ${workOrder?.workOrderNumber ?? id}`,
        description: feedback || `Rating: ${rating}/5`,
        workOrderId: id,
        rating,
      });

      if (issueNotResolved && issueDetails) {
        await workOrdersService.update(id, {
          completionNotes: `Issue not resolved: ${issueDetails}`,
        });
      }

      router.push('/requests?feedback=submitted');
    } catch (err) {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Rate Service" showBack />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  if (loadError || !workOrder) {
    return (
      <>
        <PageHeader title="Rate Service" showBack />
        <div className="px-4 py-8 text-center">
          <p className="text-gray-600">{loadError ?? 'Work order not found'}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Rate Service" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6 pb-8">
        {/* Request Context */}
        <div className="card p-4 bg-gray-50">
          <div className="text-xs text-gray-500 mb-1">{workOrder.workOrderNumber}</div>
          <div className="font-medium">{workOrder.title}</div>
          <div className="text-sm text-gray-500">{workOrder.category}</div>
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
