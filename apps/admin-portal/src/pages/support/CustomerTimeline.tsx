import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  User,
  Building2,
  CreditCard,
  FileText,
  Wrench,
  MessageSquare,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  UserCog,
  Shield,
  LogIn,
  LogOut,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  tenant: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  lastLogin: string;
  avatar: string;
}

interface TimelineEvent {
  id: string;
  type: 'payment' | 'lease' | 'maintenance' | 'communication' | 'login' | 'support' | 'account';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, string>;
  status?: 'success' | 'warning' | 'error' | 'info';
}

// ─── Mock Data ─────────────────────────────────────────────

const mockCustomers: Customer[] = [
  { id: 'C001', name: 'John Kamau', email: 'john@acmeproperties.co.ke', phone: '+254712345678', tenant: 'Acme Properties Ltd', role: 'Property Manager', status: 'active', createdAt: '2024-03-15', lastLogin: '2026-02-13T14:20:00Z', avatar: 'JK' },
  { id: 'C002', name: 'Mary Wanjiku', email: 'mary@sunriserealty.co.ke', phone: '+254723456789', tenant: 'Sunrise Realty', role: 'Admin', status: 'active', createdAt: '2024-05-20', lastLogin: '2026-02-13T10:00:00Z', avatar: 'MW' },
  { id: 'C003', name: 'Peter Ochieng', email: 'peter@metrohousing.co.ke', phone: '+254734567890', tenant: 'Metro Housing', role: 'Owner', status: 'active', createdAt: '2025-01-28', lastLogin: '2026-02-12T16:00:00Z', avatar: 'PO' },
  { id: 'C004', name: 'Fatma Hassan', email: 'fatma@coastalestates.co.ke', phone: '+254745678901', tenant: 'Coastal Estates', role: 'Admin', status: 'suspended', createdAt: '2024-08-10', lastLogin: '2026-01-15T09:00:00Z', avatar: 'FH' },
  { id: 'C005', name: 'David Kipchoge', email: 'david@highland.co.ke', phone: '+254756789012', tenant: 'Highland Properties', role: 'Property Manager', status: 'active', createdAt: '2024-01-05', lastLogin: '2026-02-13T13:00:00Z', avatar: 'DK' },
  { id: 'C006', name: 'Sarah Akinyi', email: 'sarah@acmeproperties.co.ke', phone: '+254767890123', tenant: 'Acme Properties Ltd', role: 'Accountant', status: 'active', createdAt: '2024-06-15', lastLogin: '2026-02-13T11:30:00Z', avatar: 'SA' },
];

const generateTimeline = (customerId: string): TimelineEvent[] => [
  { id: '1', type: 'login', title: 'Logged in', description: 'Successful login from Nairobi, Kenya', timestamp: '2026-02-13T14:20:00Z', status: 'success' },
  { id: '2', type: 'payment', title: 'Payment Received', description: 'Rent collection processed - KES 45,000 via M-PESA', timestamp: '2026-02-13T10:30:00Z', status: 'success', metadata: { amount: 'KES 45,000', method: 'M-PESA', reference: 'MPESA-7891234' } },
  { id: '3', type: 'maintenance', title: 'Work Order Created', description: 'Plumbing repair requested for Unit 5A', timestamp: '2026-02-12T15:00:00Z', status: 'info', metadata: { unit: '5A', priority: 'High', vendor: 'Plumber Pro Ltd' } },
  { id: '4', type: 'communication', title: 'SMS Sent', description: 'Payment reminder sent to 12 tenants', timestamp: '2026-02-12T09:00:00Z', status: 'success', metadata: { channel: 'SMS', recipients: '12' } },
  { id: '5', type: 'lease', title: 'Lease Renewed', description: 'Lease renewal for Unit 3B - 12 months', timestamp: '2026-02-10T11:00:00Z', status: 'success', metadata: { unit: '3B', duration: '12 months', rent: 'KES 35,000' } },
  { id: '6', type: 'support', title: 'Support Ticket Created', description: 'Inquiry about report generation', timestamp: '2026-02-08T14:30:00Z', status: 'info', metadata: { ticket: 'SUP-2026-0141', priority: 'Medium' } },
  { id: '7', type: 'payment', title: 'Payment Failed', description: 'M-PESA timeout - KES 22,000', timestamp: '2026-02-05T16:00:00Z', status: 'error', metadata: { amount: 'KES 22,000', reason: 'Gateway timeout' } },
  { id: '8', type: 'account', title: 'Password Changed', description: 'User changed their password', timestamp: '2026-02-01T10:00:00Z', status: 'info' },
  { id: '9', type: 'login', title: 'Failed Login Attempt', description: 'Wrong password from IP 41.89.xx.xx', timestamp: '2026-01-28T22:00:00Z', status: 'warning' },
  { id: '10', type: 'communication', title: 'Email Sent', description: 'Monthly statement delivered', timestamp: '2026-01-25T08:00:00Z', status: 'success', metadata: { channel: 'Email', type: 'Statement' } },
];

const typeIcons: Record<string, React.ElementType> = {
  payment: CreditCard, lease: FileText, maintenance: Wrench, communication: MessageSquare,
  login: LogIn, support: Phone, account: UserCog,
};
const typeColors: Record<string, string> = {
  payment: 'bg-green-100 text-green-600', lease: 'bg-blue-100 text-blue-600', maintenance: 'bg-orange-100 text-orange-600',
  communication: 'bg-violet-100 text-violet-600', login: 'bg-gray-100 text-gray-600', support: 'bg-amber-100 text-amber-600', account: 'bg-indigo-100 text-indigo-600',
};
const statusIndicators: Record<string, string> = {
  success: 'text-green-600', warning: 'text-amber-600', error: 'text-red-600', info: 'text-blue-600',
};

// ─── Component ─────────────────────────────────────────────

export default function CustomerTimeline() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateAudit, setImpersonateAudit] = useState<string[]>([]);

  const filteredCustomers = useMemo(() => {
    if (!search) return mockCustomers;
    const q = search.toLowerCase();
    return mockCustomers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.tenant.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [search]);

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setTimeline(generateTimeline(customer.id));
    setTypeFilter('all');
  };

  const filteredTimeline = useMemo(() => {
    if (typeFilter === 'all') return timeline;
    return timeline.filter((e) => e.type === typeFilter);
  }, [timeline, typeFilter]);

  const handleImpersonate = (customer: Customer) => {
    setImpersonating(true);
    setImpersonateAudit((prev) => [...prev, `${new Date().toISOString()} - Started viewing as ${customer.name} (${customer.email})`]);
  };

  const handleStopImpersonate = () => {
    if (selectedCustomer) {
      setImpersonateAudit((prev) => [...prev, `${new Date().toISOString()} - Stopped viewing as ${selectedCustomer.name}`]);
    }
    setImpersonating(false);
  };

  return (
    <div className="space-y-6">
      {/* Impersonation Banner */}
      {impersonating && selectedCustomer && (
        <div className="fixed top-0 left-64 right-0 z-50 bg-amber-500 text-white px-6 py-2 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5" />
            <span className="font-medium">View-as-User Mode: {selectedCustomer.name} ({selectedCustomer.email})</span>
            <span className="text-amber-100 text-sm">All actions are being audited</span>
          </div>
          <button onClick={handleStopImpersonate} className="flex items-center gap-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium">
            <X className="h-4 w-4" />
            Exit View-as-User
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/support')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Timeline</h1>
            <p className="text-sm text-gray-500 mt-1">Cross-tenant customer search and activity timeline</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Search Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search customers across tenants..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredCustomers.map((customer) => (
                <button key={customer.id} onClick={() => selectCustomer(customer)} className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${selectedCustomer?.id === customer.id ? 'bg-violet-50 border-l-2 border-l-violet-600' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white ${customer.status === 'active' ? 'bg-violet-500' : customer.status === 'suspended' ? 'bg-red-500' : 'bg-gray-400'}`}>
                      {customer.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm truncate">{customer.name}</p>
                        {customer.status === 'suspended' && <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">suspended</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                      <p className="text-xs text-gray-400">{customer.tenant}</p>
                    </div>
                  </div>
                </button>
              ))}
              {filteredCustomers.length === 0 && (
                <div className="p-8 text-center text-gray-500"><User className="h-8 w-8 mx-auto mb-2 text-gray-300" /><p className="text-sm">No customers found</p></div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Panel */}
        <div className="lg:col-span-2">
          {selectedCustomer ? (
            <div className="space-y-4">
              {/* Customer Info Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-medium text-white ${selectedCustomer.status === 'active' ? 'bg-violet-500' : 'bg-red-500'}`}>
                      {selectedCustomer.avatar}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selectedCustomer.name}</h2>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{selectedCustomer.email}</span>
                        <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{selectedCustomer.phone}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                        <span className="flex items-center gap-1"><Building2 className="h-4 w-4" />{selectedCustomer.tenant}</span>
                        <span className="flex items-center gap-1"><Shield className="h-4 w-4" />{selectedCustomer.role}</span>
                        <span className="flex items-center gap-1"><Clock className="h-4 w-4" />Last login: {new Date(selectedCustomer.lastLogin).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleImpersonate(selectedCustomer)} disabled={impersonating} className="flex items-center gap-2 px-3 py-1.5 text-sm text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 disabled:opacity-40">
                      <Eye className="h-4 w-4" />
                      View as User
                    </button>
                  </div>
                </div>
              </div>

              {/* Event type filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {['all', 'payment', 'lease', 'maintenance', 'communication', 'login', 'support', 'account'].map((t) => (
                  <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${typeFilter === t ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {t === 'all' ? 'All Events' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-6">
                    {filteredTimeline.map((event) => {
                      const Icon = typeIcons[event.type] || Clock;
                      const colorClass = typeColors[event.type] || 'bg-gray-100 text-gray-600';

                      return (
                        <div key={event.id} className="relative pl-12">
                          <div className={`absolute left-2 w-7 h-7 rounded-full flex items-center justify-center ${colorClass}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 text-sm">{event.title}</span>
                                {event.status && (
                                  <span className={`inline-flex items-center gap-1 ${statusIndicators[event.status]}`}>
                                    {event.status === 'success' && <CheckCircle className="h-3.5 w-3.5" />}
                                    {event.status === 'error' && <AlertTriangle className="h-3.5 w-3.5" />}
                                    {event.status === 'warning' && <AlertTriangle className="h-3.5 w-3.5" />}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400">{new Date(event.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-gray-600">{event.description}</p>
                            {event.metadata && (
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {Object.entries(event.metadata).map(([key, value]) => (
                                  <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-500">
                                    <span className="font-medium text-gray-700">{key}:</span> {value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {filteredTimeline.length === 0 && (
                  <div className="text-center py-8 text-gray-500">No events matching this filter</div>
                )}
              </div>

              {/* Audit Log for Impersonation */}
              {impersonateAudit.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Impersonation Audit Log
                  </h4>
                  <div className="space-y-1">
                    {impersonateAudit.map((entry, i) => (
                      <p key={i} className="text-xs text-amber-700 font-mono">{entry}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <User className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-700">Select a Customer</h3>
              <p className="text-sm text-gray-500 mt-1">Search and select a customer to view their full activity timeline</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
