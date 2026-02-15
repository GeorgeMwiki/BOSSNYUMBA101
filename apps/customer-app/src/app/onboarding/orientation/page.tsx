'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ChevronRight,
  Check,
  AlertCircle,
  Moon,
  Car,
  Trash2,
  Dog,
  Users,
  ShieldCheck,
  Volume2,
  Cigarette,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

interface HouseRule {
  id: string;
  icon: React.ElementType;
  title: string;
  summary: string;
  details: string[];
  acknowledged: boolean;
}

const HOUSE_RULES: HouseRule[] = [
  {
    id: 'quiet_hours',
    icon: Moon,
    title: 'Quiet Hours',
    summary: '10:00 PM - 7:00 AM daily',
    details: [
      'Keep noise to a minimum during quiet hours (10 PM - 7 AM)',
      'No loud music, parties, or construction activities',
      'Use headphones for entertainment after 10 PM',
      'Inform neighbors in advance about special events',
    ],
    acknowledged: false,
  },
  {
    id: 'parking',
    icon: Car,
    title: 'Parking Rules',
    summary: 'One assigned spot per unit',
    details: [
      'Each unit is assigned one parking space',
      'Park only in your designated spot',
      'Visitor parking is available on a first-come basis',
      'No overnight parking for non-residents without permit',
      'Do not block other vehicles or emergency access',
    ],
    acknowledged: false,
  },
  {
    id: 'waste',
    icon: Trash2,
    title: 'Waste Disposal',
    summary: 'Separate collection schedule',
    details: [
      'General waste: collected Monday, Wednesday, Friday',
      'Recyclables: collected Tuesday and Saturday',
      'Place bags in designated bins on the ground floor',
      'Do not leave waste in corridors or common areas',
      'Large items must be arranged for special collection',
    ],
    acknowledged: false,
  },
  {
    id: 'pets',
    icon: Dog,
    title: 'Pet Policy',
    summary: 'Allowed with prior approval',
    details: [
      'Pets require written management approval',
      'Maximum 1 pet per unit (cats or small dogs)',
      'Pets must be on leash in common areas',
      'Clean up after your pet immediately',
      'Pet owners are responsible for any damage',
    ],
    acknowledged: false,
  },
  {
    id: 'visitors',
    icon: Users,
    title: 'Visitor Policy',
    summary: 'Register guests at security',
    details: [
      'All visitors must register at the security gate',
      'Overnight guests must be registered in advance',
      'Maximum 3 consecutive nights for guests',
      'Residents are responsible for their guests\' behavior',
    ],
    acknowledged: false,
  },
  {
    id: 'security',
    icon: ShieldCheck,
    title: 'Security Guidelines',
    summary: 'Keep access cards secure',
    details: [
      'Do not share your access card or gate code',
      'Report lost access cards immediately',
      'Do not prop open security doors',
      'Report suspicious activity to security: +254 700 000 111',
      'Use intercom to verify deliveries before granting access',
    ],
    acknowledged: false,
  },
  {
    id: 'noise',
    icon: Volume2,
    title: 'Noise & Music',
    summary: 'Be considerate of neighbors',
    details: [
      'Keep TV and music at reasonable volume at all times',
      'No amplified music on balconies',
      'Inform management 48 hours before hosting events',
      'Construction/renovation only between 8 AM - 5 PM weekdays',
    ],
    acknowledged: false,
  },
  {
    id: 'smoking',
    icon: Cigarette,
    title: 'Smoking Policy',
    summary: 'Designated areas only',
    details: [
      'No smoking inside the building or common areas',
      'Smoking permitted only in designated outdoor areas',
      'Dispose of cigarette butts properly',
      'Violation may result in cleaning charges',
    ],
    acknowledged: false,
  },
];

export default function OnboardingOrientationPage() {
  const router = useRouter();
  const [rules, setRules] = useState<HouseRule[]>(HOUSE_RULES);
  const [expandedId, setExpandedId] = useState<string | null>(
    'quiet_hours'
  );
  const [agreedToAll, setAgreedToAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const acknowledgedCount = rules.filter((r) => r.acknowledged).length;
  const allRulesAcknowledged = acknowledgedCount === rules.length;

  const handleAcknowledge = (id: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, acknowledged: true } : r
      )
    );
    // Auto-expand next unacknowledged
    const currentIdx = rules.findIndex((r) => r.id === id);
    const nextUnack = rules.find(
      (r, idx) => idx > currentIdx && !r.acknowledged
    );
    if (nextUnack) {
      setExpandedId(nextUnack.id);
    } else {
      setExpandedId(null);
    }
  };

  const handleAcknowledgeAll = () => {
    setRules((prev) => prev.map((r) => ({ ...r, acknowledged: true })));
    setExpandedId(null);
  };

  const handleContinue = async () => {
    if (!allRulesAcknowledged || !agreedToAll) return;

    setIsSubmitting(true);

    try {
      await api.onboarding.updateStep('orientation', {
        rulesAcknowledged: rules.map((r) => r.id),
        agreedAt: new Date().toISOString(),
      });
    } catch {
      // Continue
    }

    const progress = JSON.parse(
      localStorage.getItem('onboarding_progress') || '{}'
    );
    progress.orientation = 'completed';
    localStorage.setItem('onboarding_progress', JSON.stringify(progress));

    setIsSubmitting(false);
    router.push('/onboarding/inspection');
  };

  return (
    <>
      <PageHeader title="House Rules" showBack />

      <div className="px-4 py-4 space-y-6 pb-36">
        {/* Progress */}
        <div className="card p-4 bg-primary-50 border-primary-100">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-primary-700 font-medium">
              Rules Review
            </span>
            <span className="text-primary-600">
              {acknowledgedCount} of {rules.length} reviewed
            </span>
          </div>
          <div className="h-2 bg-primary-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-300"
              style={{
                width: `${(acknowledgedCount / rules.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Quick acknowledge all */}
        {!allRulesAcknowledged && (
          <button
            type="button"
            onClick={handleAcknowledgeAll}
            className="w-full card p-3 text-sm text-primary-600 font-medium flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            I&apos;ve read all rules - acknowledge all
          </button>
        )}

        {/* Rules List */}
        <div className="space-y-3">
          {rules.map((rule) => {
            const Icon = rule.icon;
            const isExpanded = expandedId === rule.id;

            return (
              <div key={rule.id} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : rule.id)
                  }
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      rule.acknowledged ? 'bg-success-50' : 'bg-gray-100'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        rule.acknowledged
                          ? 'text-success-600'
                          : 'text-gray-600'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{rule.title}</h3>
                      {rule.acknowledged && (
                        <Check className="w-4 h-4 text-success-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{rule.summary}</p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4">
                    <ul className="space-y-2 mb-4">
                      {rule.details.map((detail, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm text-gray-600"
                        >
                          <span className="text-primary-500 mt-0.5 flex-shrink-0">
                            &bull;
                          </span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>

                    {!rule.acknowledged && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(rule.id)}
                        className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        I understand
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Final agreement */}
        {allRulesAcknowledged && (
          <div className="card p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToAll}
                onChange={(e) => setAgreedToAll(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600">
                I have read, understood, and agree to abide by all property
                rules and community guidelines. I understand that violations may
                result in penalties as outlined in my lease agreement.
              </span>
            </label>
          </div>
        )}

        {/* Notice */}
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <AlertCircle className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
          <p>
            Property rules may be updated periodically. You&apos;ll be notified
            of any changes through your preferred communication channel.
          </p>
        </div>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <button
          onClick={handleContinue}
          disabled={!allRulesAcknowledged || !agreedToAll || isSubmitting}
          className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Continue to Inspection
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </>
  );
}
