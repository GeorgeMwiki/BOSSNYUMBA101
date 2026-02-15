'use client';

import { useState } from 'react';
import {
  Search,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  ChevronRight,
  Filter,
  DollarSign,
  TrendingUp,
  Briefcase,
  Phone,
  Mail,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

// Types
interface Vendor {
  id: string;
  vendorNumber: string;
  name: string;
  email: string;
  phone: string;
  specializations: string[];
  rating: number;
  totalJobs: number;
  completedJobs: number;
  onTimePercentage: number;
  avgResponseTime: number;
  status: 'active' | 'inactive' | 'suspended';
  pendingInvoices: Invoice[];
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  workOrderId: string;
  workOrderTitle: string;
  amount: number;
  submittedDate: Date;
  dueDate: Date;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  attachments: number;
  notes?: string;
}

// Mock Data
const mockVendors: Vendor[] = [
  {
    id: '1',
    vendorNumber: 'VND-001',
    name: 'Apex Plumbing Services',
    email: 'info@apexplumbing.co.ke',
    phone: '+254 712 345 678',
    specializations: ['Plumbing', 'Water Systems'],
    rating: 4.8,
    totalJobs: 156,
    completedJobs: 152,
    onTimePercentage: 94,
    avgResponseTime: 2.5,
    status: 'active',
    pendingInvoices: [],
  },
  {
    id: '2',
    vendorNumber: 'VND-002',
    name: 'Cool Air Services',
    email: 'support@coolair.co.ke',
    phone: '+254 722 987 654',
    specializations: ['HVAC', 'Air Conditioning'],
    rating: 4.5,
    totalJobs: 89,
    completedJobs: 85,
    onTimePercentage: 88,
    avgResponseTime: 4.0,
    status: 'active',
    pendingInvoices: [],
  },
  {
    id: '3',
    vendorNumber: 'VND-003',
    name: 'SecureLock Ltd',
    email: 'orders@securelock.co.ke',
    phone: '+254 733 456 789',
    specializations: ['Security', 'Locks', 'Access Control'],
    rating: 4.7,
    totalJobs: 203,
    completedJobs: 198,
    onTimePercentage: 96,
    avgResponseTime: 1.5,
    status: 'active',
    pendingInvoices: [],
  },
  {
    id: '4',
    vendorNumber: 'VND-004',
    name: 'PowerFix Electricians',
    email: 'jobs@powerfix.co.ke',
    phone: '+254 744 234 567',
    specializations: ['Electrical', 'Wiring', 'Lighting'],
    rating: 4.9,
    totalJobs: 312,
    completedJobs: 308,
    onTimePercentage: 97,
    avgResponseTime: 2.0,
    status: 'active',
    pendingInvoices: [],
  },
  {
    id: '5',
    vendorNumber: 'VND-005',
    name: 'Prime Painters',
    email: 'hello@primepainters.co.ke',
    phone: '+254 755 876 543',
    specializations: ['Painting', 'Wall Finishing'],
    rating: 4.3,
    totalJobs: 67,
    completedJobs: 62,
    onTimePercentage: 85,
    avgResponseTime: 6.0,
    status: 'active',
    pendingInvoices: [],
  },
];

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    vendorId: '1',
    vendorName: 'Apex Plumbing Services',
    workOrderId: 'WO-001',
    workOrderTitle: 'Water Leak Repair - Unit 4B',
    amount: 15000,
    submittedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
    status: 'pending',
    attachments: 3,
    notes: 'Parts replacement + labor',
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    vendorId: '4',
    vendorName: 'PowerFix Electricians',
    workOrderId: 'WO-005',
    workOrderTitle: 'Electrical Outlet Repair - Unit 1A',
    amount: 12000,
    submittedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
    status: 'pending',
    attachments: 2,
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-003',
    vendorId: '2',
    vendorName: 'Cool Air Services',
    workOrderId: 'WO-002',
    workOrderTitle: 'AC Unit Servicing - Unit 2A',
    amount: 8500,
    submittedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
    status: 'pending',
    attachments: 1,
  },
  {
    id: '4',
    invoiceNumber: 'INV-2024-004',
    vendorId: '3',
    vendorName: 'SecureLock Ltd',
    workOrderId: 'WO-003',
    workOrderTitle: 'Lock Replacement - Unit 6C',
    amount: 5500,
    submittedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'approved',
    attachments: 2,
  },
];

export default function VendorsPage() {
  const [activeTab, setActiveTab] = useState<'vendors' | 'invoices'>('vendors');
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [specializationFilter, setSpecializationFilter] = useState<string>('all');

  const allSpecializations = [...new Set(mockVendors.flatMap((v) => v.specializations))];

  const filteredVendors = mockVendors.filter((vendor) => {
    const matchesSearch =
      !searchQuery ||
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.vendorNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSpecialization =
      specializationFilter === 'all' ||
      vendor.specializations.includes(specializationFilter);

    return matchesSearch && matchesSpecialization;
  });

  const pendingInvoices = invoices.filter((inv) => inv.status === 'pending');
  const totalPendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const handleApproveInvoice = (invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, status: 'approved' as const } : inv
      )
    );
    setSelectedInvoice(null);
  };

  const handleRejectInvoice = (invoiceId: string) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, status: 'rejected' as const } : inv
      )
    );
    setSelectedInvoice(null);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-emerald-600';
    if (rating >= 4.0) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPerformanceLevel = (percentage: number) => {
    if (percentage >= 95) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-700' };
    if (percentage >= 85) return { label: 'Good', color: 'bg-blue-100 text-blue-700' };
    if (percentage >= 70) return { label: 'Average', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Poor', color: 'bg-red-100 text-red-700' };
  };

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle={activeTab === 'vendors' ? `${filteredVendors.length} vendors` : `${pendingInvoices.length} pending`}
        action={
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} text-sm`}
          >
            <Filter className="w-4 h-4" />
          </button>
        }
      />

      {/* Tab Navigation */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('vendors')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'vendors' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Vendors
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all relative ${
              activeTab === 'invoices' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Invoices
            {pendingInvoices.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingInvoices.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'vendors' ? 'Search vendors...' : 'Search invoices...'}
            className="input pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters (Vendors Tab) */}
        {showFilters && activeTab === 'vendors' && (
          <div className="card p-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Specialization</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSpecializationFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  specializationFilter === 'all'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                All
              </button>
              {allSpecializations.map((spec) => (
                <button
                  key={spec}
                  onClick={() => setSpecializationFilter(spec)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    specializationFilter === spec
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Vendors Tab Content */}
        {activeTab === 'vendors' && (
          <div className="space-y-3">
            {filteredVendors.map((vendor) => (
              <div
                key={vendor.id}
                onClick={() => setSelectedVendor(vendor)}
                className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs text-gray-400">{vendor.vendorNumber}</span>
                    <h3 className="font-semibold">{vendor.name}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className={`font-bold ${getRatingColor(vendor.rating)}`}>
                      {vendor.rating}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {vendor.specializations.map((spec) => (
                    <span key={spec} className="badge bg-gray-100 text-gray-600 text-xs">
                      {spec}
                    </span>
                  ))}
                </div>

                {/* Scorecard Metrics */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{vendor.totalJobs}</div>
                    <div className="text-xs text-gray-500">Total Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-600">{vendor.onTimePercentage}%</div>
                    <div className="text-xs text-gray-500">On Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{vendor.avgResponseTime}h</div>
                    <div className="text-xs text-gray-500">Avg Response</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className={`badge text-xs ${getPerformanceLevel(vendor.onTimePercentage).color}`}>
                    {getPerformanceLevel(vendor.onTimePercentage).label} Performance
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Invoices Tab Content */}
        {activeTab === 'invoices' && (
          <>
            {/* Summary Card */}
            <div className="card p-4 bg-amber-50 border border-amber-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-amber-700">Pending Approval</span>
                  <div className="text-2xl font-bold text-amber-800">
                    KES {totalPendingAmount.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-amber-700">{pendingInvoices.length}</span>
                  <div className="text-xs text-amber-600">invoices</div>
                </div>
              </div>
            </div>

            {/* Invoice List */}
            <div className="space-y-3">
              {invoices
                .filter((inv) =>
                  !searchQuery ||
                  inv.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((invoice) => (
                  <div
                    key={invoice.id}
                    onClick={() => setSelectedInvoice(invoice)}
                    className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-xs text-gray-400 font-mono">{invoice.invoiceNumber}</span>
                        <h3 className="font-semibold">{invoice.vendorName}</h3>
                      </div>
                      <span
                        className={`badge text-xs ${
                          invoice.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : invoice.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : invoice.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-3">{invoice.workOrderTitle}</p>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">KES {invoice.amount.toLocaleString()}</span>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {invoice.attachments}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due {invoice.dueDate.toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {invoice.status === 'pending' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectInvoice(invoice.id);
                          }}
                          className="btn-secondary flex-1 text-sm text-red-600 border-red-200"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApproveInvoice(invoice.id);
                          }}
                          className="btn-primary flex-1 text-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}

        {/* Empty States */}
        {activeTab === 'vendors' && filteredVendors.length === 0 && (
          <div className="text-center py-12">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No vendors found</h3>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search</p>
          </div>
        )}
      </div>

      {/* Vendor Detail Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Vendor Details</h2>
              <button onClick={() => setSelectedVendor(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              {/* Vendor Header */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
                  <Briefcase className="w-7 h-7 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedVendor.name}</h3>
                  <p className="text-sm text-gray-500">{selectedVendor.vendorNumber}</p>
                </div>
              </div>

              {/* Contact */}
              <div className="flex gap-2">
                <a href={`tel:${selectedVendor.phone}`} className="btn-secondary flex-1 text-sm">
                  <Phone className="w-4 h-4" />
                  Call
                </a>
                <a href={`mailto:${selectedVendor.email}`} className="btn-secondary flex-1 text-sm">
                  <Mail className="w-4 h-4" />
                  Email
                </a>
              </div>

              {/* Scorecard */}
              <div className="card bg-gray-50 p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Performance Scorecard
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Overall Rating</span>
                      <span className="flex items-center gap-1 font-bold">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        {selectedVendor.rating}/5.0
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${(selectedVendor.rating / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">On-Time Completion</span>
                      <span className="font-bold text-emerald-600">{selectedVendor.onTimePercentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${selectedVendor.onTimePercentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-xl font-bold">{selectedVendor.totalJobs}</div>
                      <div className="text-xs text-gray-500">Total Jobs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-600">{selectedVendor.completedJobs}</div>
                      <div className="text-xs text-gray-500">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{selectedVendor.avgResponseTime}h</div>
                      <div className="text-xs text-gray-500">Avg Response</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Specializations */}
              <div>
                <h4 className="font-medium mb-2">Specializations</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedVendor.specializations.map((spec) => (
                    <span key={spec} className="badge bg-primary-100 text-primary-700">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button className="btn-secondary flex-1">View History</button>
                <button className="btn-primary flex-1">Assign Job</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Invoice Details</h2>
              <button onClick={() => setSelectedInvoice(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 font-mono">{selectedInvoice.invoiceNumber}</span>
                <span
                  className={`badge text-xs ${
                    selectedInvoice.status === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : selectedInvoice.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : selectedInvoice.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {selectedInvoice.status}
                </span>
              </div>

              <div className="card bg-gray-50 p-4">
                <div className="text-center mb-3">
                  <span className="text-sm text-gray-500">Amount</span>
                  <div className="text-3xl font-bold">KES {selectedInvoice.amount.toLocaleString()}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-gray-200">
                  <div>
                    <span className="text-gray-500">Vendor</span>
                    <p className="font-medium">{selectedInvoice.vendorName}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Work Order</span>
                    <p className="font-medium">{selectedInvoice.workOrderId}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Submitted</span>
                    <p className="font-medium">{selectedInvoice.submittedDate.toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Due Date</span>
                    <p className="font-medium">{selectedInvoice.dueDate.toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Work Description</h4>
                <p className="text-sm text-gray-600">{selectedInvoice.workOrderTitle}</p>
                {selectedInvoice.notes && (
                  <p className="text-sm text-gray-500 mt-1 italic">{selectedInvoice.notes}</p>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText className="w-4 h-4" />
                <span>{selectedInvoice.attachments} attachment(s)</span>
                <button className="text-primary-600 font-medium ml-auto">View Files</button>
              </div>

              {selectedInvoice.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleRejectInvoice(selectedInvoice.id)}
                    className="btn-secondary flex-1 text-red-600 border-red-200"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveInvoice(selectedInvoice.id)}
                    className="btn-primary flex-1"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
