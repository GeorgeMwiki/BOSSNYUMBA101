'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  Mail,
  MessageSquare,
  AlertCircle,
  ChevronRight,
  Send,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { FAQItem } from '@/components/support/FAQItem';
import { SUPPORT_PHONE, SUPPORT_EMAIL, getEmergencyContacts } from '@/lib/constants';

export default function SupportPage() {
  const t = useTranslations('supportPage');
  const faqs = [
    { question: t('faq1Q'), answer: t('faq1A') },
    { question: t('faq2Q'), answer: t('faq2A') },
    { question: t('faq3Q'), answer: t('faq3A') },
    { question: t('faq4Q'), answer: t('faq4A') },
    { question: t('faq5Q'), answer: t('faq5A') },
  ];
  const emergencyContacts = getEmergencyContacts();
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSubmitted(true);
    setFeedback('');
  };

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <div className="px-4 py-4 space-y-6">
        {/* Contact Property Management */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('contactPropertyMgmt')}
          </h3>
          <div className="card divide-y divide-gray-100">
            {SUPPORT_PHONE && (
              <a
                href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
                className="flex items-center gap-3 p-4 hover:bg-gray-50"
              >
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Phone className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{t('callUs')}</div>
                  <div className="text-sm text-gray-500">{SUPPORT_PHONE}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </a>
            )}
            {SUPPORT_EMAIL && (
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-3 p-4 hover:bg-gray-50"
              >
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Mail className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{t('emailUs')}</div>
                  <div className="text-sm text-gray-500">{SUPPORT_EMAIL}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </a>
            )}
            <Link
              href="/requests/new"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <div className="p-2 bg-primary-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{t('submitRequest')}</div>
                <div className="text-sm text-gray-500">{t('maintenanceOrInquiries')}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </section>

        {/* Quick Links */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('moreResources')}
          </h3>
          <div className="card divide-y divide-gray-100">
            <Link
              href="/announcements"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="font-medium">{t('announcements')}</div>
                <div className="text-sm text-gray-500">{t('propertyUpdates')}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link
              href="/emergencies"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="font-medium">{t('emergencyContacts')}</div>
                <div className="text-sm text-gray-500">{t('emergency247')}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </section>

        {/* Emergency Contacts (999 always shown; others from env) */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger-500" />
            {t('emergencyContacts')}
          </h3>
          <div className="card divide-y divide-gray-100">
            {emergencyContacts.map((contact, index) => (
              <a
                key={index}
                href={`tel:${contact.phone.replace(/\s/g, '')}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-sm text-gray-500">{contact.phone}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t('availableLabel')}: {contact.available}
                  </div>
                </div>
                <Phone className="w-5 h-5 text-primary-600" />
              </a>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('faqTitle')}
          </h3>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        </section>

        {/* Submit Feedback */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('submitFeedback')}
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            {t('feedbackDesc')}
          </p>
          <Link
            href="/feedback"
            className="text-sm text-primary-600 font-medium mb-3 block"
          >
            {t('goToFeedback')}
          </Link>
          {submitted ? (
            <div className="card p-4 bg-success-50 text-success-700">
              <p className="text-sm font-medium">
                {t('feedbackThanks')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitFeedback} className="card p-4 space-y-4">
              <div>
                <label htmlFor="feedback" className="label">
                  {t('feedbackLabel')}
                </label>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  className="input min-h-[100px]"
                  placeholder={t('feedbackPlaceholder')}
                />
              </div>
              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                {t('submitCta')}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
