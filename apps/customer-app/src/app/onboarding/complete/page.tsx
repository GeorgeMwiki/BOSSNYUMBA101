'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PartyPopper,
  Home,
  Key,
  Calendar,
  Phone,
  FileText,
  MapPin,
  Clock,
  CheckCircle,
  ArrowRight,
  MessageCircle,
  Star,
  Shield,
  Award,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface MoveInDetail {
  icon: React.ElementType;
  label: string;
  value: string;
}

const MOVE_IN_DETAILS: MoveInDetail[] = [
  { icon: Calendar, label: 'Move-in Date', value: 'June 1, 2024' },
  { icon: Clock, label: 'Key Collection', value: '10:00 AM - 12:00 PM' },
  { icon: MapPin, label: 'Location', value: 'Sunset Apartments, Management Office' },
];

const WELCOME_ITEMS = [
  {
    id: 'keys',
    icon: Key,
    title: 'Collect Your Keys',
    description: 'Visit the management office during business hours',
    completed: false,
  },
  {
    id: 'tour',
    icon: Home,
    title: 'Building Tour',
    description: 'Optional guided tour of amenities and common areas',
    completed: false,
  },
  {
    id: 'contacts',
    icon: Phone,
    title: 'Save Emergency Contacts',
    description: 'Security, maintenance, and management numbers',
    completed: false,
  },
  {
    id: 'app',
    icon: Star,
    title: 'Explore the App',
    description: 'Learn how to pay rent, submit requests, and more',
    completed: false,
  },
];

const TIME_SLOTS = [
  { id: '9am', label: '9:00 AM - 10:00 AM' },
  { id: '10am', label: '10:00 AM - 11:00 AM' },
  { id: '11am', label: '11:00 AM - 12:00 PM' },
  { id: '2pm', label: '2:00 PM - 3:00 PM' },
  { id: '3pm', label: '3:00 PM - 4:00 PM' },
];

export default function OnboardingCompletePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [welcomeItems, setWelcomeItems] = useState(WELCOME_ITEMS);
  const [showScheduler, setShowScheduler] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [checkInScheduled, setCheckInScheduled] = useState(false);
  const [showBadge, setShowBadge] = useState(true);

  // Trigger confetti-like animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowBadge(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Mark onboarding as complete
  useEffect(() => {
    const savedProgress = JSON.parse(
      localStorage.getItem('onboarding_progress') || '{}'
    );
    savedProgress.complete = 'completed';
    localStorage.setItem('onboarding_progress', JSON.stringify(savedProgress));
    localStorage.setItem('onboarding_completed', 'true');

    // Notify API
    api.onboarding.completeOnboarding({}).catch(() => {});
  }, []);

  const toggleWelcomeItem = (id: string) => {
    setWelcomeItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleScheduleCheckIn = async () => {
    if (!selectedDate || !selectedTime) return;

    try {
      await api.inspections.schedule({
        type: 'routine',
        preferredDate: selectedDate,
        preferredTimeSlot: selectedTime,
      });
    } catch {
      // Continue
    }

    setCheckInScheduled(true);
    setShowScheduler(false);
  };

  // Generate available dates (next 14 weekdays)
  const getAvailableDates = () => {
    const dates: string[] = [];
    const today = new Date();
    let d = new Date(today);
    d.setDate(d.getDate() + 3); // Start 3 days from now
    while (dates.length < 10) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        dates.push(d.toISOString().split('T')[0]);
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Success Header */}
      <header className="bg-gradient-to-br from-success-500 to-success-600 text-white px-4 pt-12 pb-16 text-center relative overflow-hidden">
        <div className="relative z-10 max-w-md mx-auto">
          {/* Badge Animation */}
          <div
            className={`transition-all duration-700 ${
              showBadge
                ? 'scale-100 opacity-100'
                : 'scale-50 opacity-0'
            }`}
          >
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 relative">
              <Award className="w-12 h-12" />
              <div className="absolute -top-1 -right-1 w-8 h-8 bg-warning-500 rounded-full flex items-center justify-center border-2 border-white">
                <Star className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <div className="inline-block px-4 py-1.5 bg-white/20 rounded-full text-sm font-medium mb-3">
            New Tenant Badge Earned!
          </div>

          <h1 className="text-2xl font-bold mb-2">
            You&apos;re All Set!
          </h1>
          <p className="text-success-100">
            Welcome home, {user?.firstName || 'there'}! Your onboarding is
            complete.
          </p>
        </div>

        {/* Decorative circles */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-20 -right-10 w-60 h-60 bg-white/10 rounded-full" />
      </header>

      {/* Content */}
      <div className="px-4 -mt-8 pb-8 max-w-md mx-auto space-y-6">
        {/* Move-in Details Card */}
        <div className="card p-5 shadow-lg">
          <h2 className="font-semibold text-lg mb-4">Move-in Details</h2>
          <div className="space-y-4">
            {MOVE_IN_DETAILS.map((detail, idx) => {
              const Icon = detail.icon;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <Icon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">{detail.label}</div>
                    <div className="font-medium">{detail.value}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-primary-50 rounded-lg">
            <p className="text-sm text-primary-800">
              <strong>Important:</strong> Please bring a valid ID when collecting
              your keys.
            </p>
          </div>
        </div>

        {/* Schedule First Check-In */}
        {!checkInScheduled ? (
          <div className="card p-5 border-primary-200 bg-primary-50/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Calendar className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold">Schedule First Check-In</h3>
                <p className="text-sm text-gray-500">
                  We&apos;ll check in after your first week
                </p>
              </div>
            </div>

            {showScheduler ? (
              <div className="space-y-4 mt-4">
                <div>
                  <label className="label">Select Date</label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="input"
                  >
                    <option value="">Choose a date</option>
                    {getAvailableDates().map((date) => (
                      <option key={date} value={date}>
                        {new Date(date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Select Time</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedTime(slot.id)}
                        className={`p-2.5 rounded-lg text-sm border-2 transition-all ${
                          selectedTime === slot.id
                            ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowScheduler(false)}
                    className="btn-secondary flex-1 py-3"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleScheduleCheckIn}
                    disabled={!selectedDate || !selectedTime}
                    className="btn-primary flex-1 py-3 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowScheduler(true)}
                className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Schedule Check-In
              </button>
            )}
          </div>
        ) : (
          <div className="card p-4 bg-success-50 border-success-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-success-600" />
              <div>
                <h3 className="font-medium text-success-900">
                  Check-In Scheduled
                </h3>
                <p className="text-sm text-success-700">
                  We&apos;ll see you on{' '}
                  {selectedDate &&
                    new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Welcome Checklist */}
        <div className="card p-5">
          <h2 className="font-semibold text-lg mb-4">
            Getting Started Checklist
          </h2>
          <div className="space-y-3">
            {welcomeItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => toggleWelcomeItem(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                    item.completed
                      ? 'bg-success-50'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                      item.completed
                        ? 'bg-success-500 border-success-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {item.completed && (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-medium text-sm ${
                        item.completed ? 'text-success-700 line-through' : ''
                      }`}
                    >
                      {item.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.description}
                    </div>
                  </div>
                  <Icon
                    className={`w-5 h-5 ${
                      item.completed ? 'text-success-500' : 'text-gray-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="font-medium text-gray-700">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/lease"
              className="card p-4 text-center hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-6 h-6 text-primary-600 mx-auto mb-2" />
              <div className="text-sm font-medium">View Lease</div>
            </Link>
            <Link
              href="/support"
              className="card p-4 text-center hover:bg-gray-50 transition-colors"
            >
              <MessageCircle className="w-6 h-6 text-primary-600 mx-auto mb-2" />
              <div className="text-sm font-medium">Get Support</div>
            </Link>
          </div>
        </div>

        {/* Contact Manager */}
        <div className="card p-4">
          <h3 className="font-medium mb-3">Your Property Manager</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-semibold">JM</span>
              </div>
              <div>
                <div className="font-medium">Jane Mwangi</div>
                <div className="text-sm text-gray-500">+254 700 123 456</div>
              </div>
            </div>
            <a href="tel:+254700123456" className="btn-secondary">
              <Phone className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* WhatsApp Community */}
        <a
          href="https://wa.me/254700123456?text=Hi!%20I%20just%20completed%20my%20onboarding%20at%20Sunset%20Apartments."
          target="_blank"
          rel="noopener noreferrer"
          className="card p-4 flex items-center gap-3 bg-success-50 border-success-200 hover:bg-success-100 transition-colors"
        >
          <div className="p-2 bg-success-100 rounded-lg">
            <MessageCircle className="w-5 h-5 text-success-700" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-success-900">
              Join Resident WhatsApp Group
            </div>
            <div className="text-sm text-success-700">
              Connect with your neighbors
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-success-600" />
        </a>

        {/* Go to Dashboard */}
        <Link
          href="/"
          className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
