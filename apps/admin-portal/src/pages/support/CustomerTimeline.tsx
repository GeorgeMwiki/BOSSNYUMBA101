/**
 * CustomerTimeline — chronological activity for a single customer.
 *
 * Assumed backend endpoints:
 *   GET /support/customers/:id/timeline?category=<all|auth|payment|ticket|system>
 *       -> { data: { customer: CustomerHeader, events: TimelineEvent[] } }
 *
 * The :id is read from the route parameter `id` (react-router).
 * If no :id is present, the user is prompted to look up a customer by email.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Clock, RefreshCw, Search, User } from 'lucide-react';
import { api, formatDateTime } from '../../lib/api';

type EventCategory = 'auth' | 'payment' | 'ticket' | 'system';

interface TimelineEvent {
  id: string;
  at: string;
  category: EventCategory;
  title: string;
  description?: string;
  actor?: string;
  metadata?: Record<string, string | number | boolean>;
}

interface CustomerHeader {
  id: string;
  name: string;
  email: string;
  tenant?: string;
}

interface TimelineResponse {
  customer: CustomerHeader;
  events: TimelineEvent[];
}

const categoryBadge: Record<EventCategory, string> = {
  auth: 'bg-indigo-100 text-indigo-700',
  payment: 'bg-emerald-100 text-emerald-700',
  ticket: 'bg-amber-100 text-amber-700',
  system: 'bg-gray-100 text-gray-700',
};

export default function CustomerTimeline() {
  const params = useParams<{ id?: string }>();
  const [customerId, setCustomerId] = useState<string>(params.id ?? '');
  const [inputId, setInputId] = useState<string>(params.id ?? '');
  const [category, setCategory] = useState<'all' | EventCategory>('all');
  const [customer, setCustomer] = useState<CustomerHeader | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(() => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    const qs = category === 'all' ? '' : `?category=${category}`;
    api
      .get<TimelineResponse>(`/support/customers/${encodeURIComponent(customerId)}/timeline${qs}`)
      .then((res) => {
        if (res.success && res.data) {
          setCustomer(res.data.customer);
          setEvents(res.data.events);
        } else {
          setError(res.error ?? 'Failed to load timeline.');
          setEvents([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [customerId, category]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerId(inputId.trim());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Timeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cross-service event history: auth, payments, support, system.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchTimeline}
          disabled={!customerId}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Refresh timeline"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <form onSubmit={handleLookup} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            placeholder="Customer ID or email"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as 'all' | EventCategory)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="all">All categories</option>
          <option value="auth">Auth</option>
          <option value="payment">Payment</option>
          <option value="ticket">Support ticket</option>
          <option value="system">System</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Load
        </button>
      </form>

      {customer && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <User className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">{customer.name}</div>
            <div className="text-xs text-gray-500">
              {customer.email}
              {customer.tenant ? ` · ${customer.tenant}` : ''}
            </div>
          </div>
        </div>
      )}

      {!customerId ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <Search className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">Enter a customer ID or email to view their timeline.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-gray-600">{error}</p>
          <button
            type="button"
            onClick={fetchTimeline}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <Clock className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No events in this window.</p>
        </div>
      ) : (
        <ol className="relative border-l border-gray-200 ml-4 space-y-6">
          {events.map((ev) => (
            <li key={ev.id} className="ml-6">
              <span className="absolute -left-1.5 flex items-center justify-center w-3 h-3 bg-violet-500 rounded-full ring-4 ring-white" />
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${categoryBadge[ev.category]}`}>
                      {ev.category}
                    </span>
                    <span className="font-medium text-gray-900">{ev.title}</span>
                  </div>
                  <time className="text-xs text-gray-500">{formatDateTime(ev.at)}</time>
                </div>
                {ev.description && <p className="text-sm text-gray-600 mt-2">{ev.description}</p>}
                {ev.actor && <p className="text-xs text-gray-400 mt-1">by {ev.actor}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
