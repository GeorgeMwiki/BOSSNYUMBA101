'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Star, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const workOrder = {
  id: '1',
  workOrderNumber: 'WO-2024-0031',
  title: 'Broken door handle',
  category: 'Structural',
};

export default function FeedbackPage() {
  const t = useTranslations('requestFeedback');
  const params = useParams();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [issueNotResolved, setIssueNotResolved] = useState(false);
  const [issueDetails, setIssueDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayRating = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    router.push('/requests?feedback=submitted');
  };

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6 pb-8">
        {/* Request Context */}
        <div className="card p-4 bg-gray-50">
          <div className="text-xs text-gray-500 mb-1">{workOrder.workOrderNumber}</div>
          <div className="font-medium">{workOrder.title}</div>
          <div className="text-sm text-gray-500">{workOrder.category}</div>
        </div>

        {/* Star Rating */}
        <section>
          <label className="label">{t('howWasService')}</label>
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
            {rating === 0 && t('tapToRate')}
            {rating === 1 && t('poor')}
            {rating === 2 && t('fair')}
            {rating === 3 && t('good')}
            {rating === 4 && t('veryGood')}
            {rating === 5 && t('excellent')}
          </div>
        </section>

        {/* Feedback Comment */}
        <section>
          <label className="label" htmlFor="feedback">
            {t('additionalFeedback')}
          </label>
          <textarea
            id="feedback"
            className="input min-h-[100px]"
            placeholder={t('feedbackPlaceholder')}
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
                {t('issueNotResolved')}
              </label>
              <p className="text-xs text-gray-500 mt-1">
                {t('issueNotResolvedBody')}
              </p>
            </div>
          </div>

          {issueNotResolved && (
            <div className="mt-4">
              <label className="label" htmlFor="issueDetails">
                {t('describeWrong')}
              </label>
              <textarea
                id="issueDetails"
                className="input min-h-[80px]"
                placeholder={t('issueDetailsPlaceholder')}
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
          {isSubmitting ? t('submitting') : t('submit')}
        </button>
      </form>
    </>
  );
}
