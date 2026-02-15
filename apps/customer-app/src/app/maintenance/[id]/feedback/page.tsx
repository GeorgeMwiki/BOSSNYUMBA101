'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Star, ThumbsUp, ThumbsDown, CheckCircle, Send, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

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
  const params = useParams();
  const ticketId = params.id as string;

  const [overallRating, setOverallRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleCategoryRating = (categoryId: string, rating: number) => {
    setCategoryRatings((prev) => ({ ...prev, [categoryId]: rating }));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (overallRating === 0) return;
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log({ ticketId, overallRating, categoryRatings, selectedTags, comment, wouldRecommend });
    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  if (isSubmitted) {
    return (
      <>
        <PageHeader title="Feedback Submitted" />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-20 h-20 bg-success-50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-success-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-8">Your feedback helps us improve our maintenance services.</p>
          <button onClick={() => router.push('/maintenance')} className="btn-primary w-full max-w-xs py-4 flex items-center justify-center gap-2">
            Back to Maintenance
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Rate Service" showBack />
      <div className="px-4 py-4 space-y-6 pb-32">
        <section className="card p-5 text-center">
          <h2 className="text-lg font-semibold mb-2">How was the service?</h2>
          <p className="text-sm text-gray-500 mb-4">Tap to rate your overall experience</p>
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setOverallRating(star)}
                className={`p-1 transition-all duration-200 ${overallRating >= star ? 'text-warning-500 scale-110' : 'text-gray-300 hover:text-warning-300'}`}
              >
                <Star className={`w-10 h-10 ${overallRating >= star ? 'fill-current' : ''}`} />
              </button>
            ))}
          </div>
          {overallRating > 0 && (
            <p className="text-sm font-medium text-primary-600">
              {overallRating === 5 ? 'Excellent!' : overallRating === 4 ? 'Great!' : overallRating === 3 ? 'Good' : overallRating === 2 ? 'Fair' : 'Poor'}
            </p>
          )}
        </section>

        {overallRating > 0 && (
          <section className="card p-4">
            <h3 className="font-medium mb-4">Rate specific aspects</h3>
            <div className="space-y-4">
              {feedbackCategories.map((category) => (
                <div key={category.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{category.label}</div>
                    <div className="text-xs text-gray-500">{category.description}</div>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleCategoryRating(category.id, star)}
                        className={`p-0.5 transition-colors ${(categoryRatings[category.id] || 0) >= star ? 'text-warning-500' : 'text-gray-300'}`}
                      >
                        <Star className={`w-5 h-5 ${(categoryRatings[category.id] || 0) >= star ? 'fill-current' : ''}`} />
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
            <h3 className="text-sm font-medium text-gray-500 mb-3">What stood out? (optional)</h3>
            <div className="flex flex-wrap gap-2">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedTags.includes(tag) ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>
        )}

        {overallRating > 0 && (
          <section className="card p-4">
            <h3 className="font-medium mb-3">Would you recommend this technician?</h3>
            <div className="flex gap-3">
              <button onClick={() => setWouldRecommend(true)} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${wouldRecommend === true ? 'bg-success-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <ThumbsUp className="w-5 h-5" />
                Yes
              </button>
              <button onClick={() => setWouldRecommend(false)} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${wouldRecommend === false ? 'bg-danger-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <ThumbsDown className="w-5 h-5" />
                No
              </button>
            </div>
          </section>
        )}

        {overallRating > 0 && (
          <section>
            <label className="label">Additional comments (optional)</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="input min-h-[100px]" placeholder="Share more details about your experience..." />
          </section>
        )}
      </div>

      {overallRating > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2">
            {isSubmitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
