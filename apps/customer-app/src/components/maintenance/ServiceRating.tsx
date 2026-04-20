'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Star, Send, ThumbsUp } from 'lucide-react';
import { Spinner } from '@bossnyumba/design-system';

interface ServiceRatingProps {
  onSubmit: (score: number, comment: string) => Promise<void>;
  onClose: () => void;
  technicianName?: string;
}

const QUICK_FEEDBACK_KEYS = [
  'quickResponse',
  'professionalService',
  'cleanWork',
  'explainedWell',
  'friendlyHelpful',
  'problemResolved',
] as const;

export function ServiceRating({ onSubmit, onClose, technicianName }: ServiceRatingProps) {
  const t = useTranslations('serviceRating');
  const quickFeedback = QUICK_FEEDBACK_KEYS.map((k) => ({ key: k, label: t(`tag.${k}`) }));
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const toggleFeedback = (feedback: string) => {
    setSelectedFeedback((prev) =>
      prev.includes(feedback)
        ? prev.filter((f) => f !== feedback)
        : [...prev, feedback]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    setSubmitting(true);
    const fullComment = [
      ...selectedFeedback,
      comment.trim(),
    ].filter(Boolean).join('. ');
    
    await onSubmit(rating, fullComment);
    setShowThankYou(true);
    
    // Auto close after showing thank you
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const getRatingLabel = (score: number) => {
    if (score === 5) return t('ratingLabels.excellent');
    if (score === 4) return t('ratingLabels.good');
    if (score === 3) return t('ratingLabels.okay');
    if (score === 2) return t('ratingLabels.poor');
    if (score === 1) return t('ratingLabels.veryPoor');
    return t('ratingLabels.tapToRate');
  };

  if (showThankYou) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm mx-4 animate-scale-in">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ThumbsUp className="w-8 h-8 text-success-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{t('thankYou')}</h3>
          <p className="text-gray-500">
            {t('feedbackHelps')}
          </p>
        </div>
        <style jsx>{`
          @keyframes scale-in {
            from {
              transform: scale(0.9);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
          .animate-scale-in {
            animation: scale-in 0.3s ease-out;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 space-y-6 max-h-[85vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">{t('howWasService')}</h3>
          {technicianName && (
            <p className="text-sm text-gray-500">
              {t('rateExperienceWith', { name: technicianName })}
            </p>
          )}
        </div>

        {/* Star Rating */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    star <= (hoveredRating || rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className={`text-sm font-medium ${rating > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
            {getRatingLabel(hoveredRating || rating)}
          </p>
        </div>

        {/* Quick Feedback Pills */}
        {rating > 0 && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              {t('whatDidYouLike')}
            </label>
            <div className="flex flex-wrap gap-2">
              {quickFeedback.map((feedback) => (
                <button
                  key={feedback.key}
                  onClick={() => toggleFeedback(feedback.key)}
                  className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                    selectedFeedback.includes(feedback.key)
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {feedback.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Comment */}
        {rating > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700">
              {t('additionalComments')}
            </label>
            <textarea
              className="input mt-2 min-h-[80px]"
              placeholder={t('commentsPlaceholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1 py-3">
            {t('skip')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                {t('submitRating')}
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
