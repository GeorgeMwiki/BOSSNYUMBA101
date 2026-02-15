'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Clock,
  CheckCircle,
  Wrench,
  User,
  Calendar,
  MapPin,
  Phone,
  Star,
  MessageCircle,
  X,
  ImageIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusTimeline } from '@/components/requests';

// Mock data - would come from API
const workOrder = {
  id: '1',
  workOrderNumber: 'WO-2024-0042',
  title: 'Kitchen sink leaking',
  description:
    'Water is dripping from under the kitchen sink. It seems to be coming from the pipe connection. The leak gets worse when running water.',
  category: 'Plumbing',
  status: 'scheduled',
  priority: 'high',
  location: 'Kitchen, under sink',
  createdAt: '2024-02-20T10:30:00Z',
  scheduledDate: '2024-02-25',
  scheduledTimeSlot: '09:00-12:00',
  assignedTechnician: {
    name: 'James Mwangi',
    phone: '+254 712 345 678',
    rating: 4.8,
  },
  permissionToEnter: true,
  photos: [
    { id: '1', url: '/placeholder-1.jpg', alt: 'Leak under sink' },
  ],
};

const timeline = [
  {
    id: '1',
    timestamp: '2024-02-20T10:30:00Z',
    action: 'Request submitted',
    status: 'submitted',
    user: 'You',
    notes: null,
  },
  {
    id: '2',
    timestamp: '2024-02-20T11:45:00Z',
    action: 'Request reviewed and assigned',
    status: 'triaged',
    user: 'Property Management',
    notes: 'Assigned to plumbing team',
  },
  {
    id: '3',
    timestamp: '2024-02-21T09:00:00Z',
    action: 'Appointment scheduled',
    status: 'scheduled',
    user: 'James Mwangi',
    notes: 'Scheduled for Feb 25, 9:00 AM - 12:00 PM',
  },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: 'badge-info' },
  triaged: { label: 'Reviewing', color: 'badge-info' },
  assigned: { label: 'Assigned', color: 'badge-warning' },
  scheduled: { label: 'Scheduled', color: 'badge-warning' },
  in_progress: { label: 'In Progress', color: 'badge-warning' },
  completed: { label: 'Completed', color: 'badge-success' },
};

const mockMessages = [
  { id: '1', from: 'customer', text: 'The leak seems to be getting worse. Is the technician still coming on the 25th?', timestamp: '2024-02-22T14:30:00Z' },
  { id: '2', from: 'staff', text: 'Yes, James will be there between 9am-12pm. He will call before arriving.', timestamp: '2024-02-22T15:00:00Z' },
];

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [messages] = useState(mockMessages);

  const status = statusConfig[workOrder.status] || statusConfig.submitted;
  const canCancel =
    workOrder.status !== 'completed' &&
    workOrder.status !== 'in_progress';

  const handleCancel = () => {
    // Simulate API call
    router.push('/requests');
  };

  return (
    <>
      <PageHeader title="Request Details" showBack />

      <div className="px-4 py-4 space-y-6 pb-8">
        {/* Request Summary */}
        <div className="card p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-gray-400 mb-1">{workOrder.workOrderNumber}</div>
              <h2 className="text-lg font-semibold">{workOrder.title}</h2>
            </div>
            <span className={status.color}>{status.label}</span>
          </div>

          <p className="text-sm text-gray-600 mb-4">{workOrder.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Wrench className="w-4 h-4 flex-shrink-0" />
              <span>{workOrder.category}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>{workOrder.location}</span>
            </div>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="card p-4">
          <h3 className="font-medium mb-4">Status</h3>
          <StatusTimeline
            events={timeline}
            currentStatus={workOrder.status}
          />
        </div>

        {/* Scheduled Visit */}
        {workOrder.scheduledDate && (
          <div className="card p-4 bg-primary-50 border-primary-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Calendar className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-primary-900">Scheduled Visit</h3>
                <p className="text-sm text-primary-700">
                  {new Date(workOrder.scheduledDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-primary-600">{workOrder.scheduledTimeSlot}</p>
              </div>
            </div>
          </div>
        )}

        {/* Assigned Technician */}
        {workOrder.assignedTechnician && (
          <div className="card p-4">
            <h3 className="font-medium mb-3">Assigned Technician</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <div className="font-medium">{workOrder.assignedTechnician.name}</div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{workOrder.assignedTechnician.rating}</span>
                  </div>
                </div>
              </div>
              <a
                href={`tel:${workOrder.assignedTechnician.phone}`}
                className="btn-secondary p-2"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {/* Photos */}
        {workOrder.photos && workOrder.photos.length > 0 && (
          <div className="card p-4">
            <h3 className="font-medium mb-3">Photos</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {workOrder.photos.map((photo) => (
                <div
                  key={photo.id}
                  className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden"
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat/Messaging */}
        <div className="card p-4">
          <h3 className="font-medium mb-3">Message Property Management</h3>
          {messages.length > 0 && (
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.from === 'customer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.from === 'customer'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.from === 'customer' ? 'text-primary-100' : 'text-gray-500'}`}>
                      {new Date(msg.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-3">
            <textarea
              className="input min-h-[80px]"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button type="button" className="btn-secondary w-full">
              <MessageCircle className="w-4 h-4 mr-2" />
              Send Message
            </button>
          </div>
        </div>

        {/* Rate Completed (link to feedback) */}
        {workOrder.status === 'completed' && (
          <Link
            href={`/requests/${params.id}/feedback`}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            <Star className="w-4 h-4" />
            Rate This Service
          </Link>
        )}

        {/* Cancel Request */}
        {canCancel && (
          <>
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="btn-secondary w-full text-danger-600 border-danger-200 hover:bg-danger-50"
            >
              Cancel Request
            </button>

            {showCancelConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
                <div className="bg-white rounded-t-xl p-6 w-full max-w-md">
                  <h3 className="font-semibold text-lg mb-2">Cancel Request?</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    This will cancel your maintenance request. You can submit a new request
                    anytime.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="btn-secondary flex-1"
                    >
                      Keep Request
                    </button>
                    <button
                      onClick={handleCancel}
                      className="btn bg-danger-500 text-white hover:bg-danger-600 flex-1"
                    >
                      Cancel Request
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
