'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle,
  User,
  Calendar,
  ChevronRight,
  X,
  Check,
  Wrench,
  Building,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

// Types
type Priority = 'emergency' | 'high' | 'medium' | 'low';
type Status = 'submitted' | 'triaged' | 'assigned' | 'in_progress' | 'completed' | 'rejected';

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  title: string;
  description: string;
  unit: string;
  property: string;
  tenant: string;
  category: string;
  priority: Priority;
  status: Status;
  createdAt: Date;
  dueDate: Date;
  assignedVendor?: string;
  slaBreached: boolean;
  estimatedCost?: number;
}

interface Vendor {
  id: string;
  name: string;
  specialization: string;
  rating: number;
  available: boolean;
}

// Mock Data
const mockWorkOrders: WorkOrder[] = [
  {
    id: '1',
    workOrderNumber: 'WO-2024-001',
    title: 'Water Leak in Kitchen',
    description: 'Tenant reports water dripping from kitchen sink pipe',
    unit: 'Unit 4B',
    property: 'Sunset Apartments',
    tenant: 'John Mwangi',
    category: 'Plumbing',
    priority: 'emergency',
    status: 'submitted',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 22 * 60 * 60 * 1000),
    slaBreached: false,
  },
  {
    id: '2',
    workOrderNumber: 'WO-2024-002',
    title: 'AC Not Cooling',
    description: 'Air conditioning unit blowing warm air',
    unit: 'Unit 2A',
    property: 'Sunrise Estate',
    tenant: 'Mary Wanjiku',
    category: 'HVAC',
    priority: 'high',
    status: 'triaged',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
    assignedVendor: 'Cool Air Services',
    slaBreached: false,
    estimatedCost: 15000,
  },
  {
    id: '3',
    workOrderNumber: 'WO-2024-003',
    title: 'Broken Door Lock',
    description: 'Front door lock mechanism is jammed',
    unit: 'Unit 6C',
    property: 'Sunset Apartments',
    tenant: 'Peter Otieno',
    category: 'Security',
    priority: 'high',
    status: 'assigned',
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
    assignedVendor: 'SecureLock Ltd',
    slaBreached: true,
    estimatedCost: 5000,
  },
  {
    id: '4',
    workOrderNumber: 'WO-2024-004',
    title: 'Paint Touch-up Needed',
    description: 'Wall paint peeling in living room corner',
    unit: 'Unit 3D',
    property: 'Green Gardens',
    tenant: 'Jane Achieng',
    category: 'General',
    priority: 'low',
    status: 'in_progress',
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 120 * 60 * 60 * 1000),
    assignedVendor: 'Prime Painters',
    slaBreached: false,
    estimatedCost: 8000,
  },
  {
    id: '5',
    workOrderNumber: 'WO-2024-005',
    title: 'Electrical Outlet Spark',
    description: 'Outlet in bedroom producing sparks when plug inserted',
    unit: 'Unit 1A',
    property: 'Sunrise Estate',
    tenant: 'Samuel Kiprop',
    category: 'Electrical',
    priority: 'emergency',
    status: 'completed',
    createdAt: new Date(Date.now() - 96 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() - 72 * 60 * 60 * 1000),
    assignedVendor: 'PowerFix Electricians',
    slaBreached: false,
    estimatedCost: 12000,
  },
];

const mockVendors: Vendor[] = [
  { id: '1', name: 'Apex Plumbing', specialization: 'Plumbing', rating: 4.8, available: true },
  { id: '2', name: 'Cool Air Services', specialization: 'HVAC', rating: 4.5, available: true },
  { id: '3', name: 'SecureLock Ltd', specialization: 'Security', rating: 4.7, available: false },
  { id: '4', name: 'PowerFix Electricians', specialization: 'Electrical', rating: 4.9, available: true },
  { id: '5', name: 'Prime Painters', specialization: 'General', rating: 4.3, available: true },
];

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(mockWorkOrders);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const filteredOrders = workOrders.filter((wo) => {
    const matchesSearch =
      !searchQuery ||
      wo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.workOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.unit.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || wo.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleAssignVendor = (vendorId: string) => {
    if (!selectedOrder) return;
    const vendor = mockVendors.find((v) => v.id === vendorId);
    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === selectedOrder.id
          ? { ...wo, assignedVendor: vendor?.name, status: 'assigned' as Status }
          : wo
      )
    );
    setShowVendorModal(false);
    setSelectedOrder(null);
  };

  const handleApprove = () => {
    if (!selectedOrder) return;
    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === selectedOrder.id ? { ...wo, status: 'in_progress' as Status } : wo
      )
    );
    setShowApprovalModal(false);
    setSelectedOrder(null);
  };

  const handleReject = () => {
    if (!selectedOrder) return;
    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === selectedOrder.id ? { ...wo, status: 'rejected' as Status } : wo
      )
    );
    setShowApprovalModal(false);
    setSelectedOrder(null);
  };

  const getPriorityStyles = (priority: Priority) => {
    switch (priority) {
      case 'emergency':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusStyles = (status: Status) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-700';
      case 'triaged':
        return 'bg-purple-100 text-purple-700';
      case 'assigned':
        return 'bg-cyan-100 text-cyan-700';
      case 'in_progress':
        return 'bg-amber-100 text-amber-700';
      case 'completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffHours = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (diffHours < 0) return `${Math.abs(diffHours)}h overdue`;
    if (diffHours < 24) return `${diffHours}h remaining`;
    return `${Math.round(diffHours / 24)}d remaining`;
  };

  return (
    <>
      <PageHeader
        title="Work Orders"
        subtitle={`${filteredOrders.length} orders`}
        action={
          <Link href="/work-orders/new" className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        {/* Search and Filter Toggle */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search work orders..."
              className="input pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="card p-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="triaged">Triaged</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Priority</label>
              <select
                className="input"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="all">All Priorities</option>
                <option value="emergency">Emergency</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {[
            { label: 'Urgent', count: workOrders.filter((w) => w.priority === 'emergency' || w.priority === 'high').length, color: 'bg-red-100 text-red-700' },
            { label: 'Pending', count: workOrders.filter((w) => w.status === 'submitted' || w.status === 'triaged').length, color: 'bg-amber-100 text-amber-700' },
            { label: 'SLA Breach', count: workOrders.filter((w) => w.slaBreached).length, color: 'bg-orange-100 text-orange-700' },
            { label: 'In Progress', count: workOrders.filter((w) => w.status === 'in_progress').length, color: 'bg-blue-100 text-blue-700' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`px-4 py-2 rounded-full whitespace-nowrap flex items-center gap-2 ${stat.color}`}
            >
              <span className="font-semibold">{stat.count}</span>
              <span className="text-sm">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Work Order List */}
        <div className="space-y-3">
          {filteredOrders.map((wo) => (
            <div key={wo.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 font-mono">{wo.workOrderNumber}</span>
                    {wo.slaBreached && (
                      <span className="badge-error text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        SLA Breached
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900">{wo.title}</h3>
                </div>
                <span className={`badge text-xs ${getPriorityStyles(wo.priority)}`}>
                  {wo.priority}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{wo.description}</p>

              <div className="flex flex-wrap gap-2 mb-3">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Building className="w-3 h-3" />
                  {wo.unit}, {wo.property}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="w-3 h-3" />
                  {wo.tenant}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Wrench className="w-3 h-3" />
                  {wo.category}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <span className={`badge text-xs ${getStatusStyles(wo.status)}`}>
                    {wo.status.replace('_', ' ')}
                  </span>
                  <span
                    className={`text-xs flex items-center gap-1 ${
                      wo.slaBreached ? 'text-red-600' : 'text-gray-500'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {formatDate(wo.dueDate)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {wo.status === 'submitted' && (
                    <button
                      onClick={() => {
                        setSelectedOrder(wo);
                        setShowVendorModal(true);
                      }}
                      className="btn-secondary text-xs py-1 px-2"
                    >
                      Assign
                    </button>
                  )}
                  {wo.status === 'triaged' && wo.estimatedCost && (
                    <button
                      onClick={() => {
                        setSelectedOrder(wo);
                        setShowApprovalModal(true);
                      }}
                      className="btn-primary text-xs py-1 px-2"
                    >
                      Review
                    </button>
                  )}
                  <Link href={`/work-orders/${wo.id}`}>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </Link>
                </div>
              </div>

              {wo.assignedVendor && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>Assigned to: <strong>{wo.assignedVendor}</strong></span>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No work orders found</h3>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first work order to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Assign Vendor Modal */}
      {showVendorModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Assign Vendor</h2>
              <button onClick={() => setShowVendorModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-gray-600 mb-4">
                Select a vendor for: <strong>{selectedOrder.title}</strong>
              </p>
              <div className="space-y-3">
                {mockVendors
                  .filter((v) => v.specialization === selectedOrder.category || v.specialization === 'General')
                  .map((vendor) => (
                    <button
                      key={vendor.id}
                      onClick={() => handleAssignVendor(vendor.id)}
                      disabled={!vendor.available}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        vendor.available
                          ? 'border-gray-200 hover:border-primary-500 hover:bg-primary-50'
                          : 'border-gray-100 bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{vendor.name}</h3>
                          <p className="text-sm text-gray-500">{vendor.specialization}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-amber-500">
                            {'★'.repeat(Math.floor(vendor.rating))}
                            <span className="text-sm text-gray-600">{vendor.rating}</span>
                          </div>
                          <span
                            className={`text-xs ${
                              vendor.available ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {vendor.available ? 'Available' : 'Busy'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Approve Work Order</h2>
              <button onClick={() => setShowApprovalModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              <div className="card bg-gray-50 p-4 mb-4">
                <h3 className="font-medium mb-2">{selectedOrder.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{selectedOrder.description}</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-sm text-gray-500">Estimated Cost</span>
                  <span className="font-bold text-lg">
                    KES {selectedOrder.estimatedCost?.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-500">Vendor</span>
                  <span className="font-medium">{selectedOrder.assignedVendor}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  className="btn-secondary flex-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
                <button onClick={handleApprove} className="btn-primary flex-1">
                  <Check className="w-4 h-4" />
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
