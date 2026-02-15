'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Send, MessageSquare, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const feedbackTypes = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'compliment', label: 'Compliment' },
  { value: 'other', label: 'Other' },
];

export default function FeedbackPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    type: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message.trim()) return;

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setSubmitted(true);
    setIsSubmitting(false);
    setFormData({ type: '', subject: '', message: '' });
  };

  if (submitted) {
    return (
      <>
        <PageHeader title="Submit Feedback" showBack />
        <div className="px-4 py-4">
          <div className="card p-6 bg-success-50 border-success-200 text-center">
            <div className="w-12 h-12 bg-success-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-success-900">
              Thank you for your feedback!
            </h3>
            <p className="text-sm text-success-700 mt-1">
              We appreciate you taking the time to help us improve.
            </p>
            <div className="flex gap-3 mt-6 justify-center">
              <Link href="/feedback/history" className="btn-secondary">
                View history
              </Link>
              <button
                onClick={() => setSubmitted(false)}
                className="btn-primary"
              >
                Submit another
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Submit Feedback"
        action={
          <Link
            href="/feedback/history"
            className="p-2 rounded-lg hover:bg-gray-100 text-sm text-gray-600"
          >
            History
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
        <p className="text-sm text-gray-500">
          Share your suggestions, report issues, or let us know what we&apos;re
          doing well.
        </p>

        <section>
          <label className="label">Type of feedback</label>
          <div className="flex flex-wrap gap-2">
            {feedbackTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({ ...formData, type: type.value })}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  formData.type === type.value
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="label" htmlFor="subject">
            Subject (optional)
          </label>
          <input
            type="text"
            id="subject"
            className="input"
            placeholder="Brief summary"
            value={formData.subject}
            onChange={(e) =>
              setFormData({ ...formData, subject: e.target.value })
            }
          />
        </section>

        <section>
          <label className="label" htmlFor="message">
            Your feedback
          </label>
          <textarea
            id="message"
            className="input min-h-[120px]"
            placeholder="Share your suggestions or report an issue..."
            value={formData.message}
            onChange={(e) =>
              setFormData({ ...formData, message: e.target.value })
            }
            required
          />
        </section>

        <button
          type="submit"
          className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          disabled={!formData.message.trim() || isSubmitting}
        >
          <Send className="w-5 h-5" />
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>
    </>
  );
}
