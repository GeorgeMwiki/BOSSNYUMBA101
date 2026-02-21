'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  DollarSign,
  Filter,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Send,
  User,
  X,
  FileText,
  TrendingDown,
  CheckCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

// Types
interface ArrearsRecord {
  id: string;
  tenant: {
    id: string;
    name: string;
    email: string;
    phone: string;
    unit: string;
    property: string;
  };
  totalDue: number;
  monthsOverdue: number;
  lastPaymentDate: Date | null;
  lastPaymentAmount: number;
  lastReminderSent: Date | null;
  status: 'current' | 'warning' | 'critical' | 'legal';
  notes: string[];
  paymentPlan?: PaymentPlan;
}

interface PaymentPlan {
  id: string;
  totalAmount: number;
  installments: number;
  installmentAmount: number;
  startDate: Date;
  nextPaymentDate: Date;
  paidInstallments: number;
  status: 'active' | 'completed' | 'defaulted';
}

interface ReminderTemplate {
  id: string;
  name: string;
  channel: 'sms' | 'email' | 'whatsapp';
  message: string;
}

// Mock Data
const mockArrears: ArrearsRecord[] = [
  {
    id: '1',
    tenant: {
      id: 't1',
      name: 'John Mwangi',
      email: 'john.mwangi@email.com',
      phone: '+254 712 345 678',
      unit: 'Unit 4B',
      property: 'Sunset Apartments',
    },
    totalDue: 70000,
    monthsOverdue: 2,
    lastPaymentDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    lastPaymentAmount: 35000,
    lastReminderSent: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: 'warning',
    notes: ['Promised to pay by 15th', 'Lost job recently'],
  },
  {
    id: '2',
    tenant: {
      id: 't2',
      name: 'Mary Wanjiku',
      email: 'mary.wanjiku@email.com',
      phone: '+254 722 987 654',
      unit: 'Unit 2A',
      property: 'Sunrise Estate',
    },
    totalDue: 145000,
    monthsOverdue: 4,
    lastPaymentDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    lastPaymentAmount: 45000,
    lastReminderSent: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    status: 'critical',
    notes: ['Multiple payment promises not kept', 'Consider legal action'],
    paymentPlan: {
      id: 'pp1',
      totalAmount: 145000,
      installments: 4,
      installmentAmount: 36250,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      nextPaymentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      paidInstallments: 1,
      status: 'active',
    },
  },
  {
    id: '3',
    tenant: {
      id: 't3',
      name: 'Peter Otieno',
      email: 'peter.otieno@email.com',
      phone: '+254 733 456 789',
      unit: 'Unit 6C',
      property: 'Green Gardens',
    },
    totalDue: 28000,
    monthsOverdue: 1,
    lastPaymentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    lastPaymentAmount: 28000,
    lastReminderSent: null,
    status: 'current',
    notes: [],
  },
  {
    id: '4',
    tenant: {
      id: 't4',
      name: 'Jane Achieng',
      email: 'jane.achieng@email.com',
      phone: '+254 744 234 567',
      unit: 'Unit 3D',
      property: 'Sunset Apartments',
    },
    totalDue: 210000,
    monthsOverdue: 6,
    lastPaymentDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
    lastPaymentAmount: 35000,
    lastReminderSent: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: 'legal',
    notes: ['Legal notice sent', 'Eviction process started', 'Court date: March 15'],
  },
  {
    id: '5',
    tenant: {
      id: 't5',
      name: 'Samuel Kiprop',
      email: 'samuel.kiprop@email.com',
      phone: '+254 755 876 543',
      unit: 'Unit 1A',
      property: 'Sunrise Estate',
    },
    totalDue: 45000,
    monthsOverdue: 1,
    lastPaymentDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    lastPaymentAmount: 45000,
    lastReminderSent: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: 'warning',
    notes: ['First time late payer'],
  },
];

const reminderTemplates: ReminderTemplate[] = [
  {
    id: '1',
    name: 'Friendly Reminder',
    channel: 'sms',
    message: 'Hi {name}, this is a gentle reminder that your rent of KES {amount} is due. Please make payment at your earliest convenience.',
  },
  {
    id: '2',
    name: 'Overdue Notice',
    channel: 'email',
    message: 'Dear {name}, your rent payment of KES {amount} is now {days} days overdue. Please settle immediately to avoid further action.',
  },
  {
    id: '3',
    name: 'Final Warning',
    channel: 'whatsapp',
    message: 'URGENT: {name}, your account is seriously overdue (KES {amount}). Legal action will commence if payment is not received within 48 hours.',
  },
];

export default function CollectionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ArrearsRecord | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showPaymentPlanModal, setShowPaymentPlanModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReminderTemplate | null>(null);
  
  // Payment Plan Form State
  const [planAmount, setPlanAmount] = useState('');
  const [planInstallments, setPlanInstallments] = useState('3');
  const [planStartDate, setPlanStartDate] = useState('');

  const filteredArrears = mockArrears.filter((record) => {
    const matchesSearch =
      !searchQuery ||
      record.tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.tenant.unit.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalArrears = mockArrears.reduce((sum, r) => sum + r.totalDue, 0);
  const criticalCount = mockArrears.filter((r) => r.status === 'critical' || r.status === 'legal').length;

  const getStatusStyles = (status: ArrearsRecord['status']) => {
    switch (status) {
      case 'current':
        return 'bg-amber-100 text-amber-700';
      case 'warning':
        return 'bg-orange-100 text-orange-700';
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'legal':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: ArrearsRecord['status']) => {
    switch (status) {
      case 'current':
        return '1 Month';
      case 'warning':
        return '2-3 Months';
      case 'critical':
        return '4+ Months';
      case 'legal':
        return 'Legal';
    }
  };

  const sendReminder = () => {
    if (!selectedRecord || !selectedTemplate) return;
    setShowReminderModal(false);
    setSelectedTemplate(null);
  };

  const createPaymentPlan = () => {
    if (!selectedRecord || !planAmount || !planInstallments) return;
    setShowPaymentPlanModal(false);
    setPlanAmount('');
    setPlanInstallments('3');
    setPlanStartDate('');
  };

  return (
    <>
      <PageHeader
        title="Collections"
        subtitle={`KES ${totalArrears.toLocaleString()} outstanding`}
        action={
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} text-sm`}
          >
            <Filter className="w-4 h-4" />
          </button>
        }
      />

      <div className="px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 bg-red-50 border border-red-100">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-600">Total Arrears</span>
            </div>
            <span className="text-xl font-bold text-red-700">
              KES {totalArrears.toLocaleString()}
            </span>
          </div>
          <div className="card p-4 bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-600">Critical Cases</span>
            </div>
            <span className="text-xl font-bold text-amber-700">{criticalCount} tenants</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            className="input pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="card p-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Arrears Status
            </label>
            <div className="flex flex-wrap gap-2">
              {['all', 'current', 'warning', 'critical', 'legal'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'All' : getStatusLabel(status as ArrearsRecord['status'])}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Arrears Table */}
        <div className="space-y-3">
          {filteredArrears.map((record) => (
            <div
              key={record.id}
              className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedRecord(record)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{record.tenant.name}</h3>
                    <p className="text-xs text-gray-500">
                      {record.tenant.unit}, {record.tenant.property}
                    </p>
                  </div>
                </div>
                <span className={`badge text-xs ${getStatusStyles(record.status)}`}>
                  {getStatusLabel(record.status)}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Amount Due</span>
                  <span className="text-lg font-bold text-red-600">
                    KES {record.totalDue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">
                    {record.monthsOverdue} month{record.monthsOverdue > 1 ? 's' : ''} overdue
                  </span>
                  {record.lastPaymentDate && (
                    <span className="text-xs text-gray-400">
                      Last paid: {record.lastPaymentDate.toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {record.paymentPlan && (
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700">Payment Plan Active</span>
                    <span className="text-xs text-blue-600">
                      {record.paymentPlan.paidInstallments}/{record.paymentPlan.installments} paid
                    </span>
                  </div>
                  <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        width: `${(record.paymentPlan.paidInstallments / record.paymentPlan.installments) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    Next payment: KES {record.paymentPlan.installmentAmount.toLocaleString()} on{' '}
                    {record.paymentPlan.nextPaymentDate.toLocaleDateString()}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {record.lastReminderSent
                    ? `Reminder sent ${Math.floor((Date.now() - record.lastReminderSent.getTime()) / (1000 * 60 * 60 * 24))}d ago`
                    : 'No reminder sent'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRecord(record);
                      setShowReminderModal(true);
                    }}
                    className="btn-secondary text-xs py-1 px-2"
                  >
                    <Send className="w-3 h-3" />
                    Remind
                  </button>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredArrears.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">All caught up!</h3>
            <p className="text-sm text-gray-500 mt-1">No outstanding arrears found</p>
          </div>
        )}
      </div>

      {/* Tenant Detail Modal */}
      {selectedRecord && !showReminderModal && !showPaymentPlanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Collection Details</h2>
              <button onClick={() => setSelectedRecord(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              {/* Tenant Info */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-7 h-7 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedRecord.tenant.name}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedRecord.tenant.unit}, {selectedRecord.tenant.property}
                  </p>
                </div>
              </div>

              {/* Contact Actions */}
              <div className="flex gap-2">
                <a
                  href={`tel:${selectedRecord.tenant.phone}`}
                  className="btn-secondary flex-1 text-sm"
                >
                  <Phone className="w-4 h-4" />
                  Call
                </a>
                <a
                  href={`mailto:${selectedRecord.tenant.email}`}
                  className="btn-secondary flex-1 text-sm"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </a>
                <button className="btn-secondary flex-1 text-sm">
                  <MessageSquare className="w-4 h-4" />
                  SMS
                </button>
              </div>

              {/* Amount Summary */}
              <div className="card bg-red-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-600 font-medium">Total Outstanding</span>
                  <span className={`badge text-xs ${getStatusStyles(selectedRecord.status)}`}>
                    {getStatusLabel(selectedRecord.status)}
                  </span>
                </div>
                <span className="text-3xl font-bold text-red-700">
                  KES {selectedRecord.totalDue.toLocaleString()}
                </span>
                <p className="text-sm text-red-600 mt-1">
                  {selectedRecord.monthsOverdue} month{selectedRecord.monthsOverdue > 1 ? 's' : ''}{' '}
                  overdue
                </p>
              </div>

              {/* Payment History */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Last Payment
                </h4>
                {selectedRecord.lastPaymentDate ? (
                  <div className="card bg-gray-50 p-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Amount</span>
                      <span className="font-medium">
                        KES {selectedRecord.lastPaymentAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-sm text-gray-600">Date</span>
                      <span className="text-sm">
                        {selectedRecord.lastPaymentDate.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No payment history</p>
                )}
              </div>

              {/* Notes */}
              {selectedRecord.notes.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Notes
                  </h4>
                  <div className="space-y-2">
                    {selectedRecord.notes.map((note, idx) => (
                      <div key={idx} className="bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="btn-primary w-full"
                >
                  <Send className="w-4 h-4" />
                  Send Reminder
                </button>
                {!selectedRecord.paymentPlan && (
                  <button
                    onClick={() => {
                      setPlanAmount(selectedRecord.totalDue.toString());
                      setShowPaymentPlanModal(true);
                    }}
                    className="btn-secondary w-full"
                  >
                    <Calendar className="w-4 h-4" />
                    Create Payment Plan
                  </button>
                )}
                <button className="btn-secondary w-full text-red-600 border-red-200 hover:bg-red-50">
                  <AlertTriangle className="w-4 h-4" />
                  Escalate to Legal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Send Reminder</h2>
              <button onClick={() => setShowReminderModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Choose a reminder template for <strong>{selectedRecord.tenant.name}</strong>
              </p>

              <div className="space-y-3">
                {reminderTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      selectedTemplate?.id === template.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{template.name}</span>
                      <span className={`badge text-xs ${
                        template.channel === 'sms'
                          ? 'bg-blue-100 text-blue-700'
                          : template.channel === 'email'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {template.channel.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{template.message}</p>
                  </button>
                ))}
              </div>

              <button
                onClick={sendReminder}
                disabled={!selectedTemplate}
                className={`btn-primary w-full ${!selectedTemplate ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Send className="w-4 h-4" />
                Send Reminder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Plan Modal */}
      {showPaymentPlanModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Create Payment Plan</h2>
              <button onClick={() => setShowPaymentPlanModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="card bg-gray-50 p-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tenant</span>
                  <span className="font-medium">{selectedRecord.tenant.name}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-sm text-gray-600">Outstanding</span>
                  <span className="font-medium text-red-600">
                    KES {selectedRecord.totalDue.toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Total Amount
                </label>
                <input
                  type="number"
                  className="input"
                  value={planAmount}
                  onChange={(e) => setPlanAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Number of Installments
                </label>
                <select
                  className="input"
                  value={planInstallments}
                  onChange={(e) => setPlanInstallments(e.target.value)}
                >
                  <option value="2">2 months</option>
                  <option value="3">3 months</option>
                  <option value="4">4 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Start Date
                </label>
                <input
                  type="date"
                  className="input"
                  value={planStartDate}
                  onChange={(e) => setPlanStartDate(e.target.value)}
                />
              </div>

              {planAmount && planInstallments && (
                <div className="card bg-blue-50 p-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-700">Monthly Installment</span>
                    <span className="font-bold text-blue-700">
                      KES {Math.ceil(Number(planAmount) / Number(planInstallments)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={createPaymentPlan}
                disabled={!planAmount || !planInstallments}
                className={`btn-primary w-full ${
                  !planAmount || !planInstallments ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
