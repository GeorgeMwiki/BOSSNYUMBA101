import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Clock,
  ChevronDown,
  ChevronRight,
  Shield,
  Settings,
  UserPlus,
  Edit,
  Trash2,
  LogIn,
  LogOut,
  CreditCard,
  Building2,
} from 'lucide-react';
import { formatDateTime } from '../lib/api';

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  category: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  tenant: string | null;
  resource: {
    type: string;
    id: string;
    name: string;
  };
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

const actionIcons: Record<string, React.ElementType> = {
  'user.login': LogIn,
  'user.logout': LogOut,
  'user.created': UserPlus,
  'user.updated': Edit,
  'user.deleted': Trash2,
  'role.updated': Shield,
  'settings.updated': Settings,
  'payment.processed': CreditCard,
  'tenant.created': Building2,
  default: FileText,
};

const actionColors: Record<string, { bg: string; text: string }> = {
  created: { bg: 'bg-green-100', text: 'text-green-700' },
  updated: { bg: 'bg-blue-100', text: 'text-blue-700' },
  deleted: { bg: 'bg-red-100', text: 'text-red-700' },
  login: { bg: 'bg-gray-100', text: 'text-gray-700' },
  logout: { bg: 'bg-gray-100', text: 'text-gray-700' },
  processed: { bg: 'bg-green-100', text: 'text-green-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' },
};

const auditEvents: AuditEvent[] = [
  {
    id: '1',
    timestamp: new Date().toISOString(),
    action: 'user.login',
    category: 'Authentication',
    actor: {
      id: '1',
      name: 'System Admin',
      email: 'admin@bossnyumba.com',
      role: 'SUPER_ADMIN',
    },
    tenant: null,
    resource: { type: 'session', id: 'sess_123', name: 'Admin Session' },
    details: { method: 'password', mfaUsed: false },
    ipAddress: '197.232.12.45',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    action: 'tenant.created',
    category: 'Tenant Management',
    actor: {
      id: '1',
      name: 'System Admin',
      email: 'admin@bossnyumba.com',
      role: 'SUPER_ADMIN',
    },
    tenant: null,
    resource: {
      type: 'tenant',
      id: 'ten_456',
      name: 'Makini Properties Ltd',
    },
    details: { plan: 'Professional', trialDays: 14 },
    ipAddress: '197.232.12.45',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    action: 'user.created',
    category: 'User Management',
    actor: {
      id: '2',
      name: 'Support Team',
      email: 'support@bossnyumba.com',
      role: 'SUPPORT',
    },
    tenant: 'Acme Properties Ltd',
    resource: { type: 'user', id: 'usr_789', name: 'Jane Doe' },
    details: { email: 'jane@acmeproperties.co.ke', role: 'PROPERTY_MANAGER' },
    ipAddress: '197.232.15.78',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    action: 'settings.updated',
    category: 'Configuration',
    actor: {
      id: '1',
      name: 'System Admin',
      email: 'admin@bossnyumba.com',
      role: 'SUPER_ADMIN',
    },
    tenant: null,
    resource: {
      type: 'settings',
      id: 'payments',
      name: 'Payment Configuration',
    },
    details: {
      changes: { 'mpesa.paybill': { from: '123455', to: '123456' } },
    },
    ipAddress: '197.232.12.45',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    action: 'role.updated',
    category: 'Access Control',
    actor: {
      id: '1',
      name: 'System Admin',
      email: 'admin@bossnyumba.com',
      role: 'SUPER_ADMIN',
    },
    tenant: 'Sunrise Realty',
    resource: { type: 'user', id: 'usr_234', name: 'Mary Wanjiku' },
    details: { previousRole: 'ACCOUNTANT', newRole: 'PROPERTY_MANAGER' },
    ipAddress: '197.232.12.45',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  },
  {
    id: '6',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    action: 'payment.processed',
    category: 'Billing',
    actor: {
      id: 'system',
      name: 'System',
      email: 'system@bossnyumba.com',
      role: 'SYSTEM',
    },
    tenant: 'Acme Properties Ltd',
    resource: { type: 'invoice', id: 'inv_567', name: 'January Invoice' },
    details: { amount: 125000, currency: 'KES', method: 'mpesa' },
    ipAddress: '10.0.0.1',
    userAgent: 'BOSSNYUMBA/System',
  },
  {
    id: '7',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    action: 'user.deleted',
    category: 'User Management',
    actor: {
      id: '1',
      name: 'System Admin',
      email: 'admin@bossnyumba.com',
      role: 'SUPER_ADMIN',
    },
    tenant: 'Coastal Estates',
    resource: { type: 'user', id: 'usr_890', name: 'Test User' },
    details: { reason: 'Account cleanup' },
    ipAddress: '197.232.12.45',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  },
];

export function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('last7');

  const getActionType = (action: string) => {
    const parts = action.split('.');
    return parts[parts.length - 1];
  };

  const getActionIcon = (action: string) => {
    return actionIcons[action] || actionIcons.default;
  };

  const filteredEvents = auditEvents.filter((event) => {
    const matchesSearch =
      event.actor.name.toLowerCase().includes(search.toLowerCase()) ||
      event.actor.email.toLowerCase().includes(search.toLowerCase()) ||
      event.resource.name.toLowerCase().includes(search.toLowerCase()) ||
      event.action.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || event.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(auditEvents.map((e) => e.category)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-500">Track all system activities and changes</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="h-4 w-4" />
          Export Log
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="today">Today</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="h-4 w-4" />
            More Filters
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {auditEvents.length}
          </p>
          <p className="text-sm text-gray-500">Total Events</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {auditEvents.filter((e) => e.action.includes('login')).length}
          </p>
          <p className="text-sm text-gray-500">Login Events</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {
              auditEvents.filter((e) => e.category === 'Configuration')
                .length
            }
          </p>
          <p className="text-sm text-gray-500">Config Changes</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {new Set(auditEvents.map((e) => e.actor.id)).size}
          </p>
          <p className="text-sm text-gray-500">Active Users</p>
        </div>
      </div>

      {/* Event List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filteredEvents.map((event) => {
            const ActionIcon = getActionIcon(event.action);
            const actionType = getActionType(event.action);
            const actionColor =
              actionColors[actionType] || actionColors.updated;
            const isExpanded = expandedEvent === event.id;

            return (
              <div key={event.id} className="hover:bg-gray-50">
                <button
                  onClick={() =>
                    setExpandedEvent(isExpanded ? null : event.id)
                  }
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${actionColor.bg}`}>
                      <ActionIcon className={`h-4 w-4 ${actionColor.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {event.action.replace('.', ' › ')}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${actionColor.bg} ${actionColor.text}`}
                        >
                          {actionType}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {event.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{event.actor.name}</span>
                        {' • '}
                        {event.resource.name}
                        {event.tenant && (
                          <>
                            {' • '}
                            <span className="text-violet-600">
                              {event.tenant}
                            </span>
                          </>
                        )}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(event.timestamp)}
                        </span>
                        <span>{event.ipAddress}</span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="ml-10 p-4 bg-gray-50 rounded-lg space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Actor</p>
                          <p className="text-sm font-medium text-gray-900">
                            {event.actor.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {event.actor.email}
                          </p>
                          <p className="text-xs text-violet-600">
                            {event.actor.role}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Resource</p>
                          <p className="text-sm font-medium text-gray-900">
                            {event.resource.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Type: {event.resource.type}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID: {event.resource.id}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Details</p>
                        <pre className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">User Agent</p>
                        <p className="text-xs text-gray-600 truncate">
                          {event.userAgent}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {filteredEvents.length === 0 && (
        <div className="text-center py-12 text-gray-500">No events found</div>
      )}
    </div>
  );
}
