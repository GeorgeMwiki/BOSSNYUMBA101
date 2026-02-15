'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Search,
  Send,
  FileText,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Scale,
  Banknote,
  UserCheck,
  Calendar,
  Phone,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { invoicesService } from '@bossnyumba/api-client';

// ─── Types ──────────────────────────────────────────────────────────────────

type AgingBucket = '0-7' | '8-14' | '15-30' | '31-60' | '60+';

interface ArrearsItem {
  id: string;
  customerId: string;
  customerName: string;
  unitNumber: string;
  property: string;
  phone: string;
  email: string;
  totalArrears: number;
  currency: string;
  daysOverdue: number;
  agingBucket: AgingBucket;
  invoiceCount: number;
  lastPaymentDate: string | null;
  lastReminderDate: string | null;
  paymentPlanActive: boolean;
  status: 'new' | 'reminded' | 'payment_plan' | 'escalated' | 'legal';
}

// ─── Fallback data ──────────────────────────────────────────────────────────

const fallbackArrears: ArrearsItem[] = [
  {
    id: 'arr-1', customerId: 'c1', customerName: 'James Mwangi', unitNumber: 'A-201',
    property: 'Sunset Apartments', phone: '+254 712 345 678', email: 'james@email.com',
    totalArrears: 45000, currency: 'KES', daysOverdue: 5, agingBucket: '0-7',
    invoiceCount: 1, lastPaymentDate: '2024-02-10', lastReminderDate: null,
    paymentPlanActive: false, status: 'new',
  },
  {
    id: 'arr-2', customerId: 'c2', customerName: 'Grace Wanjiru', unitNumber: 'B-105',
    property: 'Sunset Apartments', phone: '+254 723 456 789', email: 'grace@email.com',
    totalArrears: 90000, currency: 'KES', daysOverdue: 12, agingBucket: '8-14',
    invoiceCount: 2, lastPaymentDate: '2024-01-28', lastReminderDate: '2024-02-15',
    paymentPlanActive: false, status: 'reminded',
  },
  {
    id: 'arr-3', customerId: 'c3', customerName: 'Peter Ochieng', unitNumber: 'C-302',
    property: 'Sunset Apartments', phone: '+254 734 567 890', email: 'peter@email.com',
    totalArrears: 135000, currency: 'KES', daysOverdue: 22, agingBucket: '15-30',
    invoiceCount: 3, lastPaymentDate: '2024-01-15', lastReminderDate: '2024-02-10',
    paymentPlanActive: true, status: 'payment_plan',
  },
  {
    id: 'arr-4', customerId: 'c4', customerName: 'Mary Njoki', unitNumber: 'A-104',
    property: 'Sunset Apartments', phone: '+254 745 678 901', email: 'mary@email.com',
    totalArrears: 180000, currency: 'KES', daysOverdue: 45, agingBucket: '31-60',
    invoiceCount: 4, lastPaymentDate: '2024-01-01', lastReminderDate: '2024-02-08',
    paymentPlanActive: false, status: 'escalated',
  },
  {
    id: 'arr-5', customerId: 'c5', customerName: 'David Kimani', unitNumber: 'B-201',
    property: 'Sunset Apartments', phone: '+254 756 789 012', email: 'david@email.com',
    totalArrears: 270000, currency: 'KES', daysOverdue: 75, agingBucket: '60+',
    invoiceCount: 5, lastPaymentDate: '2023-12-01', lastReminderDate: '2024-02-05',
    paymentPlanActive: false, status: 'legal',
  },
  {
    id: 'arr-6', customerId: 'c6', customerName: 'Ann Wambui', unitNumber: 'C-101',
    property: 'Sunset Apartments', phone: '+254 767 890 123', email: 'ann@email.com',
    totalArrears: 25000, currency: 'KES', daysOverdue: 3, agingBucket: '0-7',
    invoiceCount: 1, lastPaymentDate: '2024-02-12', lastReminderDate: null,
    paymentPlanActive: false, status: 'new',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
  });
}

const agingBuckets: { label: string; value: AgingBucket; color: string; bgColor: string }[] = [
  { label: '0-7 days', value: '0-7', color: 'text-warning-600', bgColor: 'bg-warning-50 border-warning-200' },
  { label: '8-14 days', value: '8-14', color: 'text-warning-700', bgColor: 'bg-warning-100 border-warning-300' },
  { label: '15-30 days', value: '15-30', color: 'text-danger-500', bgColor: 'bg-danger-50 border-danger-200' },
  { label: '31-60 days', value: '31-60', color: 'text-danger-600', bgColor: 'bg-danger-100 border-danger-300' },
  { label: '60+ days', value: '60+', color: 'text-danger-700', bgColor: 'bg-danger-200 border-danger-400' },
];

const statusConfig: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  new: { label: 'New', badge: 'badge-gray', icon: Clock },
  reminded: { label: 'Reminded', badge: 'badge-info', icon: Send },
  payment_plan: { label: 'Payment Plan', badge: 'badge-primary', icon: Calendar },
  escalated: { label: 'Escalated', badge: 'badge-warning', icon: AlertTriangle },
  legal: { label: 'Legal', badge: 'badge-danger', icon: Scale },
};

// ─── Page Component ─────────────────────────────────────────────────────────

export default function CollectionsPage() {
  const [selectedBucket, setSelectedBucket] = useState<AgingBucket | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ArrearsItem | null>(null);
  const [showActionModal, setShowActionModal] = useState<'reminder' | 'payment_plan' | 'waive' | 'legal' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch overdue invoices from API
  const { data: overdueData, isLoading } = useQuery({
    queryKey: ['invoices', 'overdue'],
    queryFn: () => invoicesService.getOverdue({ page: 1, pageSize: 200 }),
    retry: false,
  });

  // Map API data to arrears items or use fallback
  const arrearsData: ArrearsItem[] = useMemo(() => {
    if (!overdueData?.data?.length) return fallbackArrears;

    return overdueData.data.map((inv) => {
      const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
      let agingBucket: AgingBucket = '0-7';
      if (daysOverdue > 60) agingBucket = '60+';
      else if (daysOverdue > 30) agingBucket = '31-60';
      else if (daysOverdue > 14) agingBucket = '15-30';
      else if (daysOverdue > 7) agingBucket = '8-14';

      return {
        id: inv.id,
        customerId: inv.customerId,
        customerName: inv.customer?.name ?? 'Unknown',
        unitNumber: inv.unit?.unitNumber ?? '—',
        property: '',
        phone: '',
        email: '',
        totalArrears: inv.amountDue,
        currency: inv.currency,
        daysOverdue,
        agingBucket,
        invoiceCount: 1,
        lastPaymentDate: null,
        lastReminderDate: null,
        paymentPlanActive: false,
        status: 'new' as const,
      };
    });
  }, [overdueData]);

  const filteredItems = useMemo(() => {
    return arrearsData.filter((item) => {
      const bucketMatch = selectedBucket === 'all' || item.agingBucket === selectedBucket;
      const searchMatch =
        !searchQuery ||
        item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.unitNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return bucketMatch && searchMatch;
    });
  }, [arrearsData, selectedBucket, searchQuery]);

  const bucketSummary = useMemo(() => {
    const summary: Record<AgingBucket, { count: number; total: number }> = {
      '0-7': { count: 0, total: 0 },
      '8-14': { count: 0, total: 0 },
      '15-30': { count: 0, total: 0 },
      '31-60': { count: 0, total: 0 },
      '60+': { count: 0, total: 0 },
    };
    arrearsData.forEach((item) => {
      summary[item.agingBucket].count++;
      summary[item.agingBucket].total += item.totalArrears;
    });
    return summary;
  }, [arrearsData]);

  const totalArrears = arrearsData.reduce((sum, i) => sum + i.totalArrears, 0);

  const handleAction = useCallback(async (action: string) => {
    setActionLoading(true);
    // Simulate action
    await new Promise((r) => setTimeout(r, 1000));
    setActionLoading(false);
    setShowActionModal(null);
    setSelectedItem(null);
  }, []);

  return (
    <>
      <PageHeader
        title="Collections"
        subtitle={`${arrearsData.length} accounts in arrears`}
        showBack
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Total Arrears Summary */}
            <div className="card p-4 bg-danger-50 border-danger-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-danger-600 font-medium">Total Arrears</div>
                  <div className="text-3xl font-bold text-danger-700">
                    {formatCurrency(totalArrears)}
                  </div>
                </div>
                <div className="p-3 bg-danger-100 rounded-full">
                  <DollarSign className="w-6 h-6 text-danger-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-danger-600">
                <span>{arrearsData.length} accounts</span>
                <span>{arrearsData.reduce((sum, i) => sum + i.invoiceCount, 0)} invoices</span>
              </div>
            </div>

            {/* Aging Buckets */}
            <div className="overflow-x-auto -mx-4 px-4">
              <div className="flex gap-2 min-w-max pb-2">
                <button
                  onClick={() => setSelectedBucket('all')}
                  className={`flex-shrink-0 rounded-lg border px-3 py-2 text-center min-w-[80px] transition-colors ${
                    selectedBucket === 'all'
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  <div className="text-lg font-bold">{arrearsData.length}</div>
                  <div className="text-xs">All</div>
                </button>
                {agingBuckets.map((bucket) => (
                  <button
                    key={bucket.value}
                    onClick={() => setSelectedBucket(bucket.value)}
                    className={`flex-shrink-0 rounded-lg border px-3 py-2 text-center min-w-[80px] transition-colors ${
                      selectedBucket === bucket.value
                        ? `${bucket.bgColor} ${bucket.color}`
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    <div className="text-lg font-bold">{bucketSummary[bucket.value].count}</div>
                    <div className="text-xs">{bucket.label}</div>
                    <div className="text-xs font-medium mt-0.5">
                      {formatCurrency(bucketSummary[bucket.value].total)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or unit..."
                className="input pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Arrears List */}
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const st = statusConfig[item.status];
                const StIcon = st.icon;
                return (
                  <div
                    key={item.id}
                    className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold">{item.customerName}</div>
                        <div className="text-sm text-gray-500">
                          Unit {item.unitNumber} &bull; {item.property}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-danger-600">
                          {formatCurrency(item.totalArrears, item.currency)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {item.daysOverdue} days overdue
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={st.badge}>
                          <StIcon className="w-3 h-3 mr-1 inline" />
                          {st.label}
                        </span>
                        {item.paymentPlanActive && (
                          <span className="badge-primary">
                            <Calendar className="w-3 h-3 mr-1 inline" />
                            Plan Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {item.invoiceCount} invoice{item.invoiceCount !== 1 ? 's' : ''}
                        <ChevronRight className={`w-4 h-4 transition-transform ${selectedItem?.id === item.id ? 'rotate-90' : ''}`} />
                      </div>
                    </div>

                    {/* Expanded Actions */}
                    {selectedItem?.id === item.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        {/* Contact Info */}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {item.phone && (
                            <a href={`tel:${item.phone}`} className="flex items-center gap-1 text-primary-600">
                              <Phone className="w-3 h-3" /> Call
                            </a>
                          )}
                          {item.email && (
                            <a href={`mailto:${item.email}`} className="flex items-center gap-1 text-primary-600">
                              <Mail className="w-3 h-3" /> Email
                            </a>
                          )}
                          <Link href={`/messaging/new?customerId=${item.customerId}`} className="flex items-center gap-1 text-primary-600">
                            <MessageSquare className="w-3 h-3" /> Message
                          </Link>
                        </div>

                        {/* Payment History */}
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>Last payment: {formatDate(item.lastPaymentDate)}</span>
                          <span>Last reminder: {formatDate(item.lastReminderDate)}</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            className="btn-primary text-sm flex items-center justify-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowActionModal('reminder');
                            }}
                          >
                            <Send className="w-4 h-4" />
                            Send Reminder
                          </button>
                          <button
                            className="btn-secondary text-sm flex items-center justify-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowActionModal('payment_plan');
                            }}
                          >
                            <Calendar className="w-4 h-4" />
                            Payment Plan
                          </button>
                          <button
                            className="btn-secondary text-sm flex items-center justify-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowActionModal('waive');
                            }}
                          >
                            <Banknote className="w-4 h-4" />
                            Waive Fee
                          </button>
                          <button
                            className="btn-danger text-sm flex items-center justify-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowActionModal('legal');
                            }}
                          >
                            <Scale className="w-4 h-4" />
                            Escalate Legal
                          </button>
                        </div>

                        <Link
                          href={`/customers/${item.customerId}`}
                          className="text-sm text-primary-600 flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Customer Profile <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-success-300 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900">No arrears found</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {searchQuery
                      ? 'Try a different search'
                      : 'All accounts are in good standing for this period'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Action Modal ──────────────────────────────────────────────────── */}
      {showActionModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowActionModal(null)}
          />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {showActionModal === 'reminder' && (
              <>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Send className="w-5 h-5 text-primary-500" />
                  Send Payment Reminder
                </h3>
                <p className="text-sm text-gray-500">
                  Send a reminder to <strong>{selectedItem.customerName}</strong> for{' '}
                  <strong>{formatCurrency(selectedItem.totalArrears, selectedItem.currency)}</strong> overdue.
                </p>
                <div className="space-y-2">
                  <label className="label">Reminder Channel</label>
                  <div className="flex gap-2">
                    {['SMS', 'WhatsApp', 'Email'].map((ch) => (
                      <button key={ch} className="btn-secondary text-sm flex-1">{ch}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label">Custom Message (optional)</label>
                  <textarea
                    className="input min-h-[80px]"
                    placeholder="Add a personal note to the standard reminder..."
                  />
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1" onClick={() => setShowActionModal(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={() => handleAction('reminder')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send Reminder
                  </button>
                </div>
              </>
            )}

            {showActionModal === 'payment_plan' && (
              <>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-500" />
                  Approve Payment Plan
                </h3>
                <p className="text-sm text-gray-500">
                  Create a payment plan for <strong>{selectedItem.customerName}</strong>.
                  Total arrears: <strong>{formatCurrency(selectedItem.totalArrears, selectedItem.currency)}</strong>
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="label">Number of Installments</label>
                    <select className="input">
                      <option>2 months</option>
                      <option>3 months</option>
                      <option>4 months</option>
                      <option>6 months</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">First Payment Date</label>
                    <input type="date" className="input" />
                  </div>
                  <div className="p-3 bg-primary-50 rounded-lg text-sm">
                    <div className="font-medium text-primary-700">Plan Summary</div>
                    <div className="text-primary-600 mt-1">
                      3 installments of {formatCurrency(Math.ceil(selectedItem.totalArrears / 3), selectedItem.currency)} each
                    </div>
                    <div className="text-xs text-primary-500 mt-1">
                      Policy limit: Up to 6 months for arrears under KES 500,000
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1" onClick={() => setShowActionModal(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={() => handleAction('payment_plan')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve Plan
                  </button>
                </div>
              </>
            )}

            {showActionModal === 'waive' && (
              <>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-warning-500" />
                  Waive Late Fee
                </h3>
                <p className="text-sm text-gray-500">
                  Waive late fees for <strong>{selectedItem.customerName}</strong>.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="label">Fee Amount to Waive</label>
                    <input type="number" className="input" placeholder="Amount in KES" />
                  </div>
                  <div>
                    <label className="label">Reason</label>
                    <select className="input">
                      <option>First-time late payment</option>
                      <option>Financial hardship</option>
                      <option>System/billing error</option>
                      <option>Good payment history</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="p-3 bg-warning-50 rounded-lg text-sm text-warning-700">
                    <div className="font-medium">Approval Authority</div>
                    <div className="text-xs mt-1">
                      You can waive up to KES 5,000 per account per month. Larger waivers require supervisor approval.
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1" onClick={() => setShowActionModal(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={() => handleAction('waive')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Waive Fee
                  </button>
                </div>
              </>
            )}

            {showActionModal === 'legal' && (
              <>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Scale className="w-5 h-5 text-danger-500" />
                  Escalate to Legal
                </h3>
                <p className="text-sm text-gray-500">
                  Initiate legal proceedings for <strong>{selectedItem.customerName}</strong>.
                  Total arrears: <strong>{formatCurrency(selectedItem.totalArrears, selectedItem.currency)}</strong>
                </p>
                <div className="p-3 bg-danger-50 rounded-lg text-sm text-danger-700 space-y-2">
                  <div className="font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    This action cannot be easily undone
                  </div>
                  <ul className="text-xs space-y-1 ml-6 list-disc">
                    <li>A formal demand letter will be generated</li>
                    <li>The customer&apos;s account will be flagged for legal action</li>
                    <li>The legal team will be notified</li>
                    <li>A 14-day notice period will start</li>
                  </ul>
                </div>
                <div>
                  <label className="label">Additional Notes</label>
                  <textarea
                    className="input min-h-[60px]"
                    placeholder="Any context for the legal team..."
                  />
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1" onClick={() => setShowActionModal(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn-danger flex-1"
                    onClick={() => handleAction('legal')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
                    Escalate to Legal
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
