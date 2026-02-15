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
import { PageHeader } from '@/components/layout/PageHeader';
import { FAQItem } from '@/components/support/FAQItem';

const faqs = [
  {
    question: 'How do I pay my rent?',
    answer:
      'You can pay rent through M-Pesa or bank transfer. Go to Payments > Pay and follow the instructions. Payment confirmation is sent within 24 hours.',
  },
  {
    question: 'How do I submit a maintenance request?',
    answer:
      'Go to Requests > New Request, select the issue category, describe the problem, and add photos if needed. We typically respond within 24–48 hours.',
  },
  {
    question: 'When is my rent due?',
    answer:
      'Rent is due on the 1st of each month. You can view your exact due date and amount in the Lease section. We send reminders 5 days before the due date.',
  },
  {
    question: 'How do I download my lease document?',
    answer:
      'Go to Lease > Documents and tap the download icon next to your lease agreement. You can also access it from the lease details page.',
  },
  {
    question: 'Who do I contact for emergencies?',
    answer:
      'For urgent maintenance (water leaks, power outages, security issues), call the emergency contact numbers listed below. For life-threatening emergencies, dial 999.',
  },
];

const emergencyContacts = [
  { name: 'Property Manager', phone: '+254 700 123 456', available: '24/7' },
  { name: 'Maintenance Emergency', phone: '+254 700 789 012', available: '8am–6pm' },
  { name: 'Security', phone: '+254 700 345 678', available: '24/7' },
];

export default function SupportPage() {
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
      <PageHeader title="Help & Support" showBack />

      <div className="px-4 py-4 space-y-6">
        {/* Contact Property Management */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Contact Property Management
          </h3>
          <div className="card divide-y divide-gray-100">
            <a
              href="tel:+254700123456"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <div className="p-2 bg-primary-50 rounded-lg">
                <Phone className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Call us</div>
                <div className="text-sm text-gray-500">+254 700 123 456</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </a>
            <a
              href="mailto:support@bossnyumba.com"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <div className="p-2 bg-primary-50 rounded-lg">
                <Mail className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Email us</div>
                <div className="text-sm text-gray-500">support@bossnyumba.com</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </a>
            <Link
              href="/requests/new"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <div className="p-2 bg-primary-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Submit a request</div>
                <div className="text-sm text-gray-500">Maintenance or inquiries</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </section>

        {/* Quick Links */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            More Resources
          </h3>
          <div className="card divide-y divide-gray-100">
            <Link
              href="/announcements"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="font-medium">Announcements</div>
                <div className="text-sm text-gray-500">Property updates</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link
              href="/emergencies"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="font-medium">Emergency Contacts</div>
                <div className="text-sm text-gray-500">24/7 numbers</div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          </div>
        </section>

        {/* Emergency Contacts */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger-500" />
            Emergency Contacts
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
                    Available: {contact.available}
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
            Frequently Asked Questions
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
            Submit Feedback
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            Or use our full feedback form for more options and history.
          </p>
          <Link
            href="/feedback"
            className="text-sm text-primary-600 font-medium mb-3 block"
          >
            Go to Feedback →
          </Link>
          {submitted ? (
            <div className="card p-4 bg-success-50 text-success-700">
              <p className="text-sm font-medium">
                Thank you! Your feedback has been submitted.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitFeedback} className="card p-4 space-y-4">
              <div>
                <label htmlFor="feedback" className="label">
                  Your feedback helps us improve
                </label>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  className="input min-h-[100px]"
                  placeholder="Share your suggestions or report an issue..."
                />
              </div>
              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                Submit feedback
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
