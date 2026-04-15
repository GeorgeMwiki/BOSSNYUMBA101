'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type WorkOrderRecord } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const feedbackCategories = [
  { id: 'quality', label: 'Work Quality', description: 'Was the issue properly fixed?' },
  { id: 'timeliness', label: 'Timeliness', description: 'Was the service completed on time?' },
  { id: 'communication', label: 'Communication', description: 'Were you kept informed?' },
  { id: 'professionalism', label: 'Professionalism', description: 'Was the technician courteous?' },
];

const quickTags = [
  'Professional',
  'Friendly',
  'Quick',
  'Thorough',
  'Clean work',
  'Good communication',
  'On time',
  'Knowledgeable',
];

export default function MaintenanceFeedbackPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams();
  const ticketId = params.id as string;

  const detailQuery = useQuery<WorkOrderRecord>({
    queryKey: ['work-orders', ticketId],
    queryFn: () => api.workOrders.get(ticketId),
    enabled: !!ticketId,
  });

  const [overallRating, setOverallRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.workOrders.rate(ticketId, {
        rating: overallRating,
        feedback: comment || undefined,
        categoryRatings,
        tags: selectedTags,
        wouldRecommend: wouldRecommend ?? undefined,
      }),
    onSuccess: () => {
      setIsSubmitted(true);
      toast.success('Thanks for your feedback');
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit feedback',
        'Submission failed'
      ),
  });

  const handleCategoryRating = (categoryId: string, rating: number) => {
    setCategoryRatings((prev) => ({ ...prev, [categoryId]: rating }));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    if (overallRating === 0) return;
    mutation.mutate();
  };

  if (isSubmitted) {
    return (
      <>
        <PageHeader title="Feedback Submitted" />
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle className="h-12 w-12 text-emerald-400" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-white">Thank You!</h2>
          <p className="mb-8 text-gray-400">
            Your feedback helps us improve our maintenance services.
          </p>
          <button
            type="button"
            onClick={() => router.push('/requests')}
            className="btn-primary flex w-full max-w-xs items-center justify-center gap-2 py-4"
          >
            Back to Maintenance
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </>
    );
  }

  const wo = detailQuery.data;

  return (
    <>
      <PageHeader title="Rate Service" showBack />
      <div className="space-y-6 px-4 py-4 pb-32">
        {wo && (
          <div className="card p-4">
            <div className="text-xs text-gray-400">
              {wo.workOrderNumber ?? `#${wo.id.slice(0, 8)}`}
            </div>
            <div className="font-medium text-white">{wo.title}</div>
            <div className="text-sm text-gray-400">{wo.category}</div>
          </div>
        )}

        <section className="card p-5 text-center">
          <h2 className="mb-2 text-lg font-semibold text-white">How was the service?</h2>
          <p className="mb-4 text-sm text-gray-400">Tap to rate your overall experience</p>
          <div className="mb-2 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setOverallRating(star)}
                className={`p-1 transition-all duration-200 ${
                  overallRating >= star ? 'scale-110 text-amber-400' : 'text-gray-500'
                }`}
              >
                <Star
                  className={`h-10 w-10 ${overallRating >= star ? 'fill-current' : ''}`}
                />
              </button>
            ))}
          </div>
          {overallRating > 0 && (
            <p className="text-sm font-medium text-primary-300">
              {overallRating === 5
                ? 'Excellent!'
                : overallRating === 4
                ? 'Great!'
                : overallRating === 3
                ? 'Good'
                : overallRating === 2
                ? 'Fair'
                : 'Poor'}
            </p>
          )}
        </section>

        {overallRating > 0 && (
          <section className="card p-4">
            <h3 className="mb-4 font-medium text-white">Rate specific aspects</h3>
            <div className="space-y-4">
              {feedbackCategories.map((category) => (
                <div key={category.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">{category.label}</div>
                    <div className="text-xs text-gray-400">{category.description}</div>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleCategoryRating(category.id, star)}
                        className={`p-0.5 transition-colors ${
                          (categoryRatings[category.id] || 0) >= star
                            ? 'text-amber-400'
                            : 'text-gray-500'
                        }`}
                      >
                        <Star
                          className={`h-5 w-5 ${
                            (categoryRatings[category.id] || 0) >= star ? 'fill-current' : ''
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {overallRating > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-medium text-gray-400">
              What stood out? (optional)
            </h3>
            <div className="flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-primary-500 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>
        )}

        {overallRating > 0 && (
          <section className="card p-4">
            <h3 className="mb-3 font-medium text-white">Would you recommend this technician?</h3>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 transition-all ${
                  wouldRecommend === true
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <ThumbsUp className="h-5 w-5" />
                Yes
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 transition-all ${
                  wouldRecommend === false
                    ? 'bg-red-500 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                <ThumbsDown className="h-5 w-5" />
                No
              </button>
            </div>
          </section>
        )}

        {overallRating > 0 && (
          <section>
            <label className="label">Additional comments (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="input min-h-[100px]"
              placeholder="Share more details about your experience..."
            />
          </section>
        )}
      </div>

      {overallRating > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#121212] p-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-base font-semibold"
          >
            {mutation.isPending ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" /> Submit Feedback
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
