'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Send, MessageSquare, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

export default function FeedbackPage() {
  const t = useTranslations('feedbackPage');
  const feedbackTypes = [
    { value: 'suggestion', label: t('typeSuggestion') },
    { value: 'complaint', label: t('typeComplaint') },
    { value: 'compliment', label: t('typeCompliment') },
    { value: 'other', label: t('typeOther') },
  ];
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
        <PageHeader title={t('title')} showBack />
        <div className="px-4 py-4">
          <div className="card p-6 bg-success-50 border-success-200 text-center">
            <div className="w-12 h-12 bg-success-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-success-900">
              {t('thankYou')}
            </h3>
            <p className="text-sm text-success-700 mt-1">
              {t('appreciation')}
            </p>
            <div className="flex gap-3 mt-6 justify-center">
              <Link href="/feedback/history" className="btn-secondary">
                {t('viewHistory')}
              </Link>
              <button
                onClick={() => setSubmitted(false)}
                className="btn-primary"
              >
                {t('submitAnother')}
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
        title={t('title')}
        action={
          <Link
            href="/feedback/history"
            className="p-2 rounded-lg hover:bg-gray-100 text-sm text-gray-600"
          >
            {t('history')}
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
        <p className="text-sm text-gray-500">
          {t('intro')}
        </p>

        <section>
          <label className="label">{t('typeLabel')}</label>
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
            {t('subjectLabel')}
          </label>
          <input
            type="text"
            id="subject"
            className="input"
            placeholder={t('subjectPlaceholder')}
            value={formData.subject}
            onChange={(e) =>
              setFormData({ ...formData, subject: e.target.value })
            }
          />
        </section>

        <section>
          <label className="label" htmlFor="message">
            {t('messageLabel')}
          </label>
          <textarea
            id="message"
            className="input min-h-[120px]"
            placeholder={t('messagePlaceholder')}
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
          {isSubmitting ? t('submitting') : t('submit')}
        </button>
      </form>
    </>
  );
}
