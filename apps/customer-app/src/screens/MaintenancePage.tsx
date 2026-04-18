'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Wrench,
  Camera,
  X,
  ChevronRight,
  Send,
  Zap,
  Droplets,
  Wind,
  Lightbulb,
  DoorOpen,
  Settings,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type TicketStatus = 'submitted' | 'in_progress' | 'scheduled' | 'completed';
type Priority = 'emergency' | 'high' | 'medium' | 'low';

interface MaintenanceTicket {
  id: string;
  workOrderNumber: string;
  title: string;
  category: string;
  status: TicketStatus;
  priority: Priority;
  createdAt: string;
  scheduledDate?: string;
  slaStatus: 'on_track' | 'at_risk' | 'breached';
  photoCount?: number;
}

interface Category {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
}

const CATEGORIES: Category[] = [
  { id: 'plumbing', name: 'Plumbing', icon: Droplets, color: 'bg-blue-50 text-blue-600' },
  { id: 'electrical', name: 'Electrical', icon: Zap, color: 'bg-yellow-50 text-yellow-600' },
  { id: 'hvac', name: 'HVAC', icon: Wind, color: 'bg-cyan-50 text-cyan-600' },
  { id: 'appliance', name: 'Appliances', icon: Settings, color: 'bg-purple-50 text-purple-600' },
  { id: 'lighting', name: 'Lighting', icon: Lightbulb, color: 'bg-amber-50 text-amber-600' },
  { id: 'general', name: 'General', icon: DoorOpen, color: 'bg-gray-100 text-gray-600' },
];

const tickets: MaintenanceTicket[] = [
  {
    id: '1',
    workOrderNumber: 'WO-2024-0042',
    title: 'Kitchen sink leaking',
    category: 'plumbing',
    status: 'scheduled',
    priority: 'high',
    createdAt: '2024-02-20',
    scheduledDate: '2024-02-25',
    slaStatus: 'on_track',
    photoCount: 3,
  },
  {
    id: '2',
    workOrderNumber: 'WO-2024-0038',
    title: 'AC not cooling properly',
    category: 'hvac',
    status: 'in_progress',
    priority: 'medium',
    createdAt: '2024-02-18',
    slaStatus: 'at_risk',
    photoCount: 2,
  },
  {
    id: '3',
    workOrderNumber: 'WO-2024-0031',
    title: 'Broken door handle',
    category: 'general',
    status: 'completed',
    priority: 'low',
    createdAt: '2024-02-10',
    slaStatus: 'on_track',
  },
];

const statusConfig: Record<TicketStatus, { label: string; icon: React.ElementType; color: string }> = {
  submitted: { label: 'Submitted', icon: Clock, color: 'badge-info' },
  in_progress: { label: 'In Progress', icon: Wrench, color: 'badge-warning' },
  scheduled: { label: 'Scheduled', icon: Clock, color: 'badge-info' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'badge-success' },
};

const priorityConfig: Record<Priority, { label: string; color: string; borderColor: string }> = {
  emergency: { label: 'Emergency', color: 'badge-danger', borderColor: 'border-l-danger-500' },
  high: { label: 'High', color: 'badge-warning', borderColor: 'border-l-warning-500' },
  medium: { label: 'Medium', color: 'badge-info', borderColor: 'border-l-primary-500' },
  low: { label: 'Low', color: 'badge-gray', borderColor: 'border-l-gray-400' },
};

export default function MaintenancePage() {
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  
  // Form state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openTickets = tickets.filter((t) => t.status !== 'completed');
  const closedTickets = tickets.filter((t) => t.status === 'completed');
  const displayedTickets = activeTab === 'open' ? openTickets : closedTickets;

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotos([...photos, url]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !title || !description) return;
    
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Reset form
    setSelectedCategory(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setPhotos([]);
    setShowNewRequestForm(false);
    setIsSubmitting(false);
  };

  const canSubmit = selectedCategory && title.trim() && description.trim();

  return (
    <>
      <PageHeader
        title="Maintenance"
        action={
          <button
            onClick={() => setShowNewRequestForm(true)}
            className="btn-primary text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Request
          </button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-primary-600">{openTickets.length}</div>
            <div className="text-xs text-gray-500">Open</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-warning-600">
              {openTickets.filter((t) => t.slaStatus === 'at_risk').length}
            </div>
            <div className="text-xs text-gray-500">At Risk</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-success-600">{closedTickets.length}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('open')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'open'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Open ({openTickets.length})
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'closed'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Completed ({closedTickets.length})
          </button>
        </div>

        {/* Tickets List */}
        <section>
          <div className="space-y-3">
            {displayedTickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
            {displayedTickets.length === 0 && (
              <div className="card p-8 text-center text-gray-500">
                <Wrench className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="font-medium mb-1">No {activeTab} requests</p>
                <p className="text-sm">
                  {activeTab === 'open'
                    ? 'Create a new request to report an issue'
                    : 'Completed requests will appear here'}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* New Request Form Modal */}
      {showNewRequestForm && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => setShowNewRequestForm(false)}
                className="p-2 -ml-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold">New Request</h1>
              <div className="w-9" />
            </div>
          </header>

          <div className="px-4 py-6 pb-32 space-y-6">
            {/* Category Selection */}
            <div>
              <label className="label">Category</label>
              <div className="grid grid-cols-3 gap-3">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`card p-4 flex flex-col items-center gap-2 transition-all ${
                        selectedCategory === cat.id
                          ? 'ring-2 ring-primary-500 bg-primary-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${cat.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="label">Issue Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief description of the issue"
                className="input"
              />
            </div>

            {/* Description */}
            <div>
              <label className="label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the problem in detail..."
                rows={4}
                className="input min-h-[120px]"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="label">Priority</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high', 'emergency'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                      priority === p
                        ? p === 'emergency'
                          ? 'bg-danger-50 text-danger-600 border-danger-200'
                          : p === 'high'
                          ? 'bg-warning-50 text-warning-600 border-warning-200'
                          : p === 'medium'
                          ? 'bg-primary-50 text-primary-600 border-primary-200'
                          : 'bg-gray-100 text-gray-600 border-gray-300'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              {priority === 'emergency' && (
                <p className="text-xs text-danger-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  For life-threatening situations, call emergency services first
                </p>
              )}
            </div>

            {/* Photo Upload */}
            <div>
              <label className="label">Photos (optional)</label>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <img
                      src={photo}
                      alt={`Issue photo ${idx + 1}`}
                      className="w-24 h-24 rounded-xl object-cover"
                    />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-danger-500 rounded-full flex items-center justify-center text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 flex-shrink-0"
                  >
                    <Camera className="w-6 h-6" />
                    <span className="text-xs mt-1">Add Photo</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Add up to 5 photos to help explain the issue
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="btn-primary w-full py-4 text-base font-semibold"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function TicketCard({ ticket }: { ticket: MaintenanceTicket }) {
  const status = statusConfig[ticket.status];
  const priorityCfg = priorityConfig[ticket.priority];
  const StatusIcon = status.icon;
  const category = CATEGORIES.find((c) => c.id === ticket.category);
  const CategoryIcon = category?.icon || Wrench;

  return (
    <Link href={`/maintenance/${ticket.id}`}>
      <div className={`card p-4 border-l-4 ${priorityCfg.borderColor} active:scale-[0.98] transition-transform`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${category?.color || 'bg-gray-100 text-gray-600'}`}>
            <CategoryIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="text-xs text-gray-400">{ticket.workOrderNumber}</div>
                <div className="font-medium">{ticket.title}</div>
              </div>
              <span className={status.color}>
                <StatusIcon className="w-3 h-3 mr-1 inline" />
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-2">
              <span>{category?.name}</span>
              {ticket.scheduledDate && (
                <>
                  <span>•</span>
                  <span>Scheduled: {new Date(ticket.scheduledDate).toLocaleDateString()}</span>
                </>
              )}
              {ticket.photoCount && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    {ticket.photoCount}
                  </span>
                </>
              )}
            </div>
            {ticket.slaStatus === 'at_risk' && (
              <div className="mt-2 flex items-center text-xs text-warning-600">
                <AlertCircle className="w-3 h-3 mr-1" />
                Response time at risk
              </div>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}
