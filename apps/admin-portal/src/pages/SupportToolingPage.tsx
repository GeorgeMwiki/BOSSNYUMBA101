import React, { useEffect, useState } from 'react';
import {
  Search,
  Phone,
  Mail,
  MessageSquare,
  Clock,
  User,
  Building2,
  Home,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  ExternalLink,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Flag,
  UserCheck,
  FileText,
  Calendar,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/api';

interface Customer {
  id: string;
  type: 'tenant' | 'landlord' | 'property_manager';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tenantOrg: string;
  status: string;
  createdAt: string;
  properties?: number;
  units?: number;
  currentBalance?: number;
  lastPayment?: string;
}

interface TimelineEvent {
  id: string;
  type: 'payment' | 'ticket' | 'lease' | 'maintenance' | 'communication' | 'system';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
  metadata?: Record<string, any>;
}

interface SupportTicket {
  id: string;
  subject: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  category: string;
  customer: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  messages: number;
}

const mockCustomers: Customer[] = [
  {
    id: '1',
    type: 'tenant',
    firstName: 'James',
    lastName: 'Otieno',
    email: 'james.otieno@gmail.com',
    phone: '+254 712 345 678',
    tenantOrg: 'Acme Properties Ltd',
    status: 'ACTIVE',
    createdAt: '2024-03-15',
    currentBalance: -5000,
    lastPayment: '2025-02-01',
  },
  {
    id: '2',
    type: 'landlord',
    firstName: 'Sarah',
    lastName: 'Mutua',
    email: 'sarah.mutua@outlook.com',
    phone: '+254 723 456 789',
    tenantOrg: 'Sunrise Realty',
    status: 'ACTIVE',
    createdAt: '2024-01-20',
    properties: 8,
    units: 24,
  },
  {
    id: '3',
    type: 'property_manager',
    firstName: 'Kevin',
    lastName: 'Waweru',
    email: 'kevin@highland.co.ke',
    phone: '+254 734 567 890',
    tenantOrg: 'Highland Properties',
    status: 'ACTIVE',
    createdAt: '2024-06-10',
    properties: 15,
    units: 120,
  },
];

const mockTimeline: TimelineEvent[] = [
  {
    id: '1',
    type: 'payment',
    title: 'Rent Payment Received',
    description: 'Monthly rent payment of KES 35,000 processed via M-Pesa',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    status: 'completed',
    metadata: { amount: 35000, method: 'M-Pesa', reference: 'TXN123456' },
  },
  {
    id: '2',
    type: 'ticket',
    title: 'Support Ticket Created',
    description: 'Issue with water heater in Unit 4B',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    status: 'open',
    metadata: { ticketId: 'TKT-2025-001', priority: 'medium' },
  },
  {
    id: '3',
    type: 'communication',
    title: 'SMS Notification Sent',
    description: 'Rent reminder sent for upcoming due date',
    timestamp: new Date(Date.now() - 259200000).toISOString(),
    metadata: { channel: 'SMS', status: 'delivered' },
  },
  {
    id: '4',
    type: 'maintenance',
    title: 'Maintenance Request Completed',
    description: 'Plumbing repair in bathroom completed',
    timestamp: new Date(Date.now() - 604800000).toISOString(),
    status: 'completed',
    metadata: { workOrderId: 'WO-456', cost: 5500 },
  },
  {
    id: '5',
    type: 'lease',
    title: 'Lease Renewal Notice',
    description: 'Lease renewal notice sent - expires in 60 days',
    timestamp: new Date(Date.now() - 864000000).toISOString(),
    metadata: { leaseEndDate: '2025-04-15' },
  },
  {
    id: '6',
    type: 'system',
    title: 'Account Created',
    description: 'Customer account created and verified',
    timestamp: new Date(Date.now() - 2592000000).toISOString(),
    status: 'completed',
  },
];

const mockTickets: SupportTicket[] = [
  {
    id: 'TKT-2025-001',
    subject: 'Water heater not working',
    priority: 'high',
    status: 'open',
    category: 'Maintenance',
    customer: 'James Otieno',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    messages: 3,
  },
  {
    id: 'TKT-2025-002',
    subject: 'Payment not reflected in account',
    priority: 'urgent',
    status: 'in_progress',
    category: 'Billing',
    customer: 'Sarah Mutua',
    assignedTo: 'Mary Akinyi',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    messages: 5,
  },
  {
    id: 'TKT-2025-003',
    subject: 'Need copy of lease agreement',
    priority: 'low',
    status: 'waiting',
    category: 'Documents',
    customer: 'Kevin Waweru',
    assignedTo: 'John Mwangi',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    messages: 2,
  },
];

const typeIcons: Record<string, React.ElementType> = {
  payment: CreditCard,
  ticket: MessageSquare,
  lease: FileText,
  maintenance: Home,
  communication: Mail,
  system: CheckCircle,
};

const typeColors: Record<string, string> = {
  payment: 'bg-green-100 text-green-600',
  ticket: 'bg-blue-100 text-blue-600',
  lease: 'bg-purple-100 text-purple-600',
  maintenance: 'bg-amber-100 text-amber-600',
  communication: 'bg-cyan-100 text-cyan-600',
  system: 'bg-gray-100 text-gray-600',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const ticketStatusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  waiting: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
};

export function SupportToolingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'tickets'>('timeline');
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalationNote, setEscalationNote] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (search.length >= 2) {
      const results = customers.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search)
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [search, customers]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCustomers(mockCustomers);
      setTimeline(mockTimeline);
      setTickets(mockTickets);
    } catch (err) {
      setError('Failed to load support data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearch('');
    setSearchResults([]);
  };

  const handleEscalate = (ticketId: string) => {
    setShowEscalateModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tooling</h1>
          <p className="text-gray-500">Customer lookup, timeline, and escalation management</p>
        </div>
      </div>

      {/* Customer Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
            {searchResults.map((customer) => (
              <button
                key={customer.id}
                onClick={() => handleSelectCustomer(customer)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0"
              >
                <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {customer.email} • {customer.tenantOrg}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    customer.type === 'tenant'
                      ? 'bg-blue-100 text-blue-700'
                      : customer.type === 'landlord'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {customer.type.replace('_', ' ')}
                </span>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            ))}
          </div>
        )}

        {search.length >= 2 && searchResults.length === 0 && (
          <div className="mt-2 p-4 text-center text-gray-500">
            No customers found matching "{search}"
          </div>
        )}
      </div>

      {/* Customer Profile & Timeline */}
      {selectedCustomer ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold">
                      {selectedCustomer.firstName[0]}{selectedCustomer.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h2>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        selectedCustomer.type === 'tenant'
                          ? 'bg-white/20 text-white'
                          : selectedCustomer.type === 'landlord'
                          ? 'bg-white/20 text-white'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      {selectedCustomer.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-gray-900">{selectedCustomer.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="text-gray-900">{selectedCustomer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Organization</p>
                    <p className="text-gray-900">{selectedCustomer.tenantOrg}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="text-gray-900">
                      {formatDate(selectedCustomer.createdAt)}
                    </p>
                  </div>
                </div>

                {selectedCustomer.currentBalance !== undefined && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Current Balance</span>
                      <span
                        className={`font-bold ${
                          selectedCustomer.currentBalance < 0
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        {formatCurrency(Math.abs(selectedCustomer.currentBalance))}
                        {selectedCustomer.currentBalance < 0 ? ' owed' : ' credit'}
                      </span>
                    </div>
                  </div>
                )}

                {selectedCustomer.properties !== undefined && (
                  <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Properties</p>
                      <p className="text-xl font-bold text-gray-900">
                        {selectedCustomer.properties}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Units</p>
                      <p className="text-xl font-bold text-gray-900">
                        {selectedCustomer.units}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <button className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                    <Phone className="h-4 w-4" />
                    Call
                  </button>
                  <button className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                    <Mail className="h-4 w-4" />
                    Email
                  </button>
                  <button className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                    <MessageSquare className="h-4 w-4" />
                    SMS
                  </button>
                  <button className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                    <ExternalLink className="h-4 w-4" />
                    View Full
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline & Tickets */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-4">
              <nav className="flex gap-8">
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'timeline'
                      ? 'border-violet-600 text-violet-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Activity Timeline
                </button>
                <button
                  onClick={() => setActiveTab('tickets')}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'tickets'
                      ? 'border-violet-600 text-violet-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Support Tickets ({tickets.length})
                </button>
              </nav>
            </div>

            {activeTab === 'timeline' ? (
              /* Timeline View */
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
                  <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>
                <div className="p-4">
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                    <div className="space-y-6">
                      {timeline.map((event, index) => {
                        const Icon = typeIcons[event.type] || Clock;
                        return (
                          <div key={event.id} className="relative flex gap-4">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                                typeColors[event.type]
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0 pb-6">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {event.title}
                                  </p>
                                  <p className="text-sm text-gray-500 mt-1">
                                    {event.description}
                                  </p>
                                  {event.metadata && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {Object.entries(event.metadata).map(
                                        ([key, value]) => (
                                          <span
                                            key={key}
                                            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                                          >
                                            {key}:{' '}
                                            {typeof value === 'number' && key === 'amount'
                                              ? formatCurrency(value)
                                              : String(value)}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  {new Date(event.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Tickets View */
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Support Tickets</h3>
                  <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm">
                    New Ticket
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-4 hover:bg-gray-50"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-400">
                              {ticket.id}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                priorityColors[ticket.priority]
                              }`}
                            >
                              {ticket.priority}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                ticketStatusColors[ticket.status]
                              }`}
                            >
                              {ticket.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900">
                            {ticket.subject}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                            <span>{ticket.category}</span>
                            <span>•</span>
                            <span>{ticket.messages} messages</span>
                            {ticket.assignedTo && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <UserCheck className="h-3 w-3" />
                                  {ticket.assignedTo}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEscalate(ticket.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg"
                          >
                            <Flag className="h-4 w-4" />
                            Escalate
                          </button>
                          <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-violet-600 hover:bg-violet-50 rounded-lg">
                            <ArrowUpRight className="h-4 w-4" />
                            Open
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No Customer Selected */
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <User className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Search for a Customer
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Enter a customer name, email, or phone number in the search box above to
            view their profile, activity timeline, and support tickets.
          </p>
        </div>
      )}

      {/* Escalation Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Escalate Ticket
              </h2>
              <p className="text-sm text-gray-500">
                Escalate this ticket to a senior support agent or manager
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Escalation Level
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="senior">Senior Support Agent</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="manager">Support Manager</option>
                  <option value="engineering">Engineering Team</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Escalation
                </label>
                <textarea
                  value={escalationNote}
                  onChange={(e) => setEscalationNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Describe why this ticket needs escalation..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="urgent"
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="urgent" className="text-sm text-gray-700">
                  Mark as urgent (notify immediately)
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowEscalateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowEscalateModal(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
              >
                <Flag className="h-4 w-4" />
                Escalate Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
