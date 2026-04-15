'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  Mail,
  MessageSquare,
  AlertCircle,
  ChevronRight,
  Send,
  Ticket as TicketIcon,
  Plus,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { FAQItem } from '@/components/support/FAQItem';
import { SUPPORT_PHONE, SUPPORT_EMAIL, getEmergencyContacts } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  category?: string;
  priority?: string;
}

const faqs = [
  {
    question: 'How do I pay my rent?',
    answer:
      'You can pay rent through M-Pesa or bank transfer. Go to Payments > Pay and follow the instructions. Payment confirmation is sent within 24 hours.',
  },
  {
    question: 'How do I submit a maintenance request?',
    answer:
      'Go to Requests > New Request, select the issue category, describe the problem, and add photos if needed. We typically respond within 24 to 48 hours.',
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

const statusBadge: Record<string, string> = {
  open: 'badge-info',
  in_progress: 'badge-warning',
  resolved: 'badge-success',
  closed: 'badge-gray',
};

export default function SupportPage() {
  const toast = useToast();
  const emergencyContacts = getEmergencyContacts();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketsError, setTicketsError] = useState('');

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'normal',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    setTicketsError('');
    try {
      const data = await api.support.listTickets();
      const list: SupportTicket[] = Array.isArray(data)
        ? (data as SupportTicket[])
        : ((data as { items?: SupportTicket[] })?.items ?? []);
      setTickets(list);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load support tickets';
      setTicketsError(msg);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.subject.trim() || !newTicket.description.trim()) return;

    setSubmitting(true);
    try {
      await api.support.createTicket({
        subject: newTicket.subject.trim(),
        description: newTicket.description.trim(),
        category: newTicket.category,
        priority: newTicket.priority,
      });
      toast.success('Ticket submitted');
      setNewTicket({
        subject: '',
        description: '',
        category: 'general',
        priority: 'normal',
      });
      setShowNewTicket(false);
      loadTickets();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to create ticket';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title="Help & Support" showBack />

      <div className="px-4 py-4 space-y-6">
        {/* Support Tickets */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              Your Support Tickets
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadTickets}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowNewTicket((v) => !v)}
                className="btn-primary text-xs flex items-center gap-1 py-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5" />
                {showNewTicket ? 'Cancel' : 'New'}
              </button>
            </div>
          </div>

          {showNewTicket && (
            <form
              onSubmit={handleCreateTicket}
              className="card p-4 space-y-3 mb-4"
            >
              <div>
                <label className="label" htmlFor="ticket-subject">
                  Subject
                </label>
                <input
                  id="ticket-subject"
                  type="text"
                  className="input"
                  placeholder="Brief summary"
                  value={newTicket.subject}
                  onChange={(e) =>
                    setNewTicket({ ...newTicket, subject: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="ticket-desc">
                  Describe your issue
                </label>
                <textarea
                  id="ticket-desc"
                  className="input min-h-[100px]"
                  placeholder="Provide as much detail as possible..."
                  value={newTicket.description}
                  onChange={(e) =>
                    setNewTicket({ ...newTicket, description: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="ticket-category">
                    Category
                  </label>
                  <select
                    id="ticket-category"
                    className="input"
                    value={newTicket.category}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, category: e.target.value })
                    }
                  >
                    <option value="general">General</option>
                    <option value="billing">Billing</option>
                    <option value="account">Account</option>
                    <option value="technical">Technical</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ticket-priority">
                    Priority
                  </label>
                  <select
                    id="ticket-priority"
                    className="input"
                    value={newTicket.priority}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, priority: e.target.value })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          )}

          {loadingTickets ? (
            <div className="card p-6 flex items-center justify-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading tickets...
            </div>
          ) : ticketsError ? (
            <div className="card p-4 bg-danger-50 border-danger-200 text-sm">
              <p className="text-danger-700 font-medium">{ticketsError}</p>
              <button
                type="button"
                onClick={loadTickets}
                className="mt-2 text-xs text-danger-700 underline"
              >
                Try again
              </button>
            </div>
          ) : tickets.length === 0 ? (
            <div className="card p-6 text-center text-gray-500">
              <TicketIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No support tickets yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Create a ticket if you need help
              </p>
            </div>
          ) : (
            <div className="card divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/support/tickets/${ticket.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {ticket.subject}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                      {ticket.category ? ` · ${ticket.category}` : ''}
                    </div>
                  </div>
                  <span
                    className={`${statusBadge[ticket.status] ?? 'badge-gray'} text-xs`}
                  >
                    {ticket.status.replace('_', ' ')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-2" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Contact Property Management */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Contact Property Management
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
                  <div className="font-medium">Call us</div>
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
                  <div className="font-medium">Email us</div>
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
            <Link
              href="/feedback"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="font-medium">Submit Feedback</div>
                <div className="text-sm text-gray-500">
                  Suggestions or compliments
                </div>
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
      </div>
    </>
  );
}
