'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Clock,
  AlertCircle,
  Wrench,
  Camera,
  X,
  Send,
  Zap,
  Droplets,
  Wind,
  Lightbulb,
  DoorOpen,
  Settings,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import {
  maintenanceService,
  type CreateMaintenanceTicketInput,
} from '@bossnyumba/api-client';

type Priority = 'low' | 'medium' | 'high' | 'emergency';

interface TicketRow {
  id: string;
  title: string;
  description?: string;
  category?: string;
  priority?: Priority | string;
  status?: string;
  createdAt?: string;
}

interface Category {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
}

interface FormErrors {
  category?: string;
  title?: string;
  description?: string;
  priority?: string;
  submit?: string;
}

const CATEGORIES: Category[] = [
  { id: 'plumbing', name: 'Plumbing', icon: Droplets, color: 'bg-blue-50 text-blue-600' },
  { id: 'electrical', name: 'Electrical', icon: Zap, color: 'bg-yellow-50 text-yellow-600' },
  { id: 'hvac', name: 'HVAC', icon: Wind, color: 'bg-cyan-50 text-cyan-600' },
  { id: 'appliance', name: 'Appliances', icon: Settings, color: 'bg-purple-50 text-purple-600' },
  { id: 'lighting', name: 'Lighting', icon: Lightbulb, color: 'bg-amber-50 text-amber-600' },
  { id: 'general', name: 'General', icon: DoorOpen, color: 'bg-gray-100 text-gray-600' },
];

function normalizeTicket(raw: unknown): TicketRow {
  const record = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(record.id ?? record.ticketId ?? ''),
    title: String(record.title ?? 'Untitled'),
    description:
      typeof record.description === 'string' ? record.description : undefined,
    category:
      typeof record.category === 'string' ? record.category : undefined,
    priority: record.priority as Priority | string | undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
  };
}

export default function MaintenancePage() {
  const { tenantId } = useAuth() as {
    user: unknown;
    token: string | null;
    tenantId?: string;
  };

  // UI state
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);

  // Form state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [photos, setPhotos] = useState<
    Array<{ url: string; filename: string }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List state
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!tenantId) {
      setTickets([]);
      setLoadError(null);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await maintenanceService.listTickets({
        tenantId,
        status: 'open',
      });
      const rows = Array.isArray(response?.data)
        ? response.data.map(normalizeTicket)
        : [];
      setTickets(rows);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load tickets';
      setLoadError(message);
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, { url, filename: file.name }]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = useCallback((): FormErrors => {
    const next: FormErrors = {};
    if (!selectedCategory) next.category = 'Category is required';
    if (!title.trim()) next.title = 'Title is required';
    if (!description.trim()) next.description = 'Description is required';
    if (!priority) next.priority = 'Priority is required';
    return next;
  }, [selectedCategory, title, description, priority]);

  const canSubmit = useMemo(() => {
    return (
      !!tenantId &&
      !!selectedCategory &&
      title.trim().length > 0 &&
      description.trim().length > 0 &&
      !isSubmitting
    );
  }, [tenantId, selectedCategory, title, description, isSubmitting]);

  const resetForm = () => {
    setSelectedCategory(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setPhotos([]);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    if (!tenantId) {
      setErrors({ submit: 'You must be signed in to submit a ticket' });
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const payload: CreateMaintenanceTicketInput = {
        tenantId,
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory as string,
        priority,
        photos: photos.map((p) => ({
          url: p.url,
          filename: p.filename,
          type: 'photo',
        })),
      };
      await maintenanceService.createTicket(payload);
      resetForm();
      setShowNewRequestForm(false);
      await loadTickets();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to submit ticket';
      setErrors({ submit: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    setClosingId(ticketId);
    try {
      await maintenanceService.closeTicket({ ticketId });
      await loadTickets();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to close ticket';
      setLoadError(message);
    } finally {
      setClosingId(null);
    }
  };

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
        data-testid="maintenance-photo-input"
      />

      <div className="px-4 py-4 space-y-6 pb-24">
        <section aria-label="Open tickets" data-testid="maintenance-tickets">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Open tickets</h2>
            <button
              type="button"
              onClick={() => void loadTickets()}
              className="text-sm text-primary-600"
              disabled={isLoading}
            >
              Refresh
            </button>
          </div>

          {isLoading && (
            <div role="status" className="card p-4 text-sm text-gray-500">
              Loading tickets...
            </div>
          )}

          {!isLoading && loadError && (
            <div role="alert" className="card p-4 text-sm text-danger-600">
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && tickets.length === 0 && (
            <div className="card p-8 text-center text-gray-500">
              <Wrench className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium mb-1">No open requests</p>
              <p className="text-sm">
                Create a new request to report an issue.
              </p>
            </div>
          )}

          {!isLoading && !loadError && tickets.length > 0 && (
            <ul className="space-y-3">
              {tickets.map((ticket) => (
                <li
                  key={ticket.id}
                  className="card p-4"
                  data-testid={`ticket-row-${ticket.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-400">
                        {ticket.category ?? 'general'}
                        {ticket.priority ? ` • ${ticket.priority}` : ''}
                      </div>
                      <div className="font-medium">{ticket.title}</div>
                      {ticket.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {ticket.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                        <Clock className="w-3 h-3" />
                        <span>
                          {ticket.createdAt
                            ? new Date(ticket.createdAt).toLocaleDateString()
                            : 'Unknown date'}
                        </span>
                        {ticket.status && (
                          <>
                            <span>•</span>
                            <span>{ticket.status}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCloseTicket(ticket.id)}
                      disabled={closingId === ticket.id}
                      className="text-xs btn-secondary px-3 py-1.5"
                      data-testid={`close-ticket-${ticket.id}`}
                    >
                      {closingId === ticket.id ? 'Closing...' : 'Close'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showNewRequestForm && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setShowNewRequestForm(false);
                  setErrors({});
                }}
                className="p-2 -ml-2 rounded-full hover:bg-gray-100"
                aria-label="Close new request form"
              >
                <X className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold">New Request</h1>
              <div className="w-9" />
            </div>
          </header>

          <form
            onSubmit={handleSubmit}
            data-testid="maintenance-form"
            aria-label="Create maintenance ticket"
            className="px-4 py-6 pb-32 space-y-6"
          >
            <div>
              <label className="label" id="category-label">
                Category
              </label>
              <div
                role="radiogroup"
                aria-labelledby="category-label"
                className="grid grid-cols-3 gap-3"
              >
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`card p-4 flex flex-col items-center gap-2 transition-all ${
                        active
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
              {errors.category && (
                <p role="alert" className="text-xs text-danger-600 mt-2">
                  {errors.category}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="ticket-title" className="label">
                Issue Title
              </label>
              <input
                id="ticket-title"
                name="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief description of the issue"
                className="input"
                aria-invalid={errors.title ? 'true' : 'false'}
              />
              {errors.title && (
                <p role="alert" className="text-xs text-danger-600 mt-1">
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="ticket-description" className="label">
                Description
              </label>
              <textarea
                id="ticket-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the problem in detail..."
                rows={4}
                className="input min-h-[120px]"
                aria-invalid={errors.description ? 'true' : 'false'}
              />
              {errors.description && (
                <p role="alert" className="text-xs text-danger-600 mt-1">
                  {errors.description}
                </p>
              )}
            </div>

            <div>
              <label className="label" id="priority-label">
                Priority
              </label>
              <div
                role="radiogroup"
                aria-labelledby="priority-label"
                className="flex gap-2"
              >
                {(['low', 'medium', 'high', 'emergency'] as Priority[]).map(
                  (p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={priority === p}
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
                  )
                )}
              </div>
              {priority === 'emergency' && (
                <p className="text-xs text-danger-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  For life-threatening situations, call emergency services
                  first
                </p>
              )}
            </div>

            <div>
              <label className="label">Photos (optional)</label>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <img
                      src={photo.url}
                      alt={`Issue photo ${idx + 1}`}
                      className="w-24 h-24 rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-danger-500 rounded-full flex items-center justify-center text-white"
                      aria-label={`Remove photo ${idx + 1}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button
                    type="button"
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

            {errors.submit && (
              <p role="alert" className="text-sm text-danger-600">
                {errors.submit}
              </p>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
              <button
                type="submit"
                disabled={!canSubmit}
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
          </form>
        </div>
      )}
    </>
  );
}
