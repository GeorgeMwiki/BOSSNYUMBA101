'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Droplets,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  Copy,
  ExternalLink,
  Info,
  Flame,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { useMutation, useQuery } from '@bossnyumba/api-client';

interface UtilitySetup {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  status: 'pending' | 'acknowledged';
  meterNumber?: string;
  accountInfo?: string;
  instructions: UtilityInstruction[];
}

interface UtilityInstruction {
  step: number;
  title: string;
  content: string;
  action?: {
    label: string;
    type: 'copy' | 'link';
    value: string;
  };
}

const DEFAULT_UTILITY_SETUPS: UtilitySetup[] = [
  {
    id: 'electricity',
    name: 'Electricity (TANESCO)',
    icon: Zap,
    description: 'Pre-paid electricity via LUKU tokens',
    status: 'pending',
    accountInfo: 'LUKU Pre-paid Meter',
    instructions: [
      {
        step: 1,
        title: 'Find Your LUKU Meter',
        content:
          'Your LUKU pre-paid electricity meter is located near the main electrical panel inside your unit. Check your meter panel for the meter number.',
      },
      {
        step: 2,
        title: 'Buy LUKU Tokens',
        content:
          'You can purchase LUKU tokens via M-Pesa. Dial *150*00# and select "Buy Electricity/LUKU". Enter your meter number when prompted. Check your meter panel for the number.',
      },
      {
        step: 3,
        title: 'Enter Token',
        content:
          'After purchase, you\'ll receive a 20-digit token via SMS. Enter this token into your LUKU meter keypad. The meter will beep and display your new credit balance.',
      },
      {
        step: 4,
        title: 'Monitor Usage',
        content:
          'Press the blue button on your meter to check your remaining units. We recommend keeping at least 30 units as a buffer. You can also track your usage in the Utilities section of this app.',
      },
    ],
  },
  {
    id: 'water',
    name: 'Water Supply',
    icon: Droplets,
    description: 'Water billing and usage',
    status: 'pending',
    accountInfo: 'Included in monthly utilities',
    instructions: [
      {
        step: 1,
        title: 'Water Meter Location',
        content:
          'Your water meter is located at the building\'s water distribution panel on the ground floor. See your unit\'s meter for the label.',
      },
      {
        step: 2,
        title: 'Billing',
        content:
          'Water is metered and billed monthly as part of your utilities charge. Readings are taken on the 25th of each month.',
      },
      {
        step: 3,
        title: 'Report Issues',
        content:
          'If you notice leaks, low water pressure, or discolored water, report it immediately through the Maintenance section of the app. Water emergencies should be reported to security.',
      },
      {
        step: 4,
        title: 'Water Conservation',
        content:
          'During dry season, water conservation measures may be in effect. You\'ll be notified of any water schedule changes via your preferred communication channel.',
      },
    ],
  },
  {
    id: 'gas',
    name: 'Gas Supply',
    icon: Flame,
    description: 'Cooking gas information',
    status: 'pending',
    instructions: [
      {
        step: 1,
        title: 'Gas Type',
        content:
          'This property uses LPG cylinder gas for cooking. Your unit is fitted with a standard gas connection point in the kitchen.',
      },
      {
        step: 2,
        title: 'Getting Gas',
        content:
          'You can order gas cylinders from approved suppliers listed in the Community section of the app. Delivery is available directly to your door.',
      },
      {
        step: 3,
        title: 'Safety',
        content:
          'Always ensure gas valves are closed when not in use. If you smell gas, open windows, do not switch on any electrical appliances, and contact security immediately.',
      },
    ],
  },
];

const ICON_MAP: Record<string, React.ElementType> = {
  electricity: Zap,
  water: Droplets,
  gas: Flame,
};

function mergeApiUtilities(apiData: UtilitySetup[] | undefined): UtilitySetup[] {
  if (!apiData || apiData.length === 0) return DEFAULT_UTILITY_SETUPS;
  return apiData.map((item) => ({
    ...item,
    icon: ICON_MAP[item.id] || Zap,
    status: item.status || 'pending',
  }));
}

export default function OnboardingUtilitiesPage() {
  const router = useRouter();
  const { data: apiUtilities } = useQuery<UtilitySetup[]>(
    '/onboarding/utilities',
    { staleTime: 5 * 60 * 1000 }
  );
  const [utilities, setUtilities] = useState<UtilitySetup[]>(DEFAULT_UTILITY_SETUPS);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>('electricity');

  // Merge API data once available
  if (apiUtilities && !hasInitialized) {
    setUtilities(mergeApiUtilities(apiUtilities));
    setHasInitialized(true);
  }
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  const logCopyMutation = useMutation<unknown, { text: string }>(
    (client, variables) => client.post('/onboarding/utilities/copy-log', { text: variables.text }),
    {
      onSuccess: (_data, variables) => {
        setCopiedText(variables.text);
      },
      onSettled: () => {
        setCopiedText(null);
      },
    }
  );

  const acknowledgedCount = utilities.filter(
    (u) => u.status === 'acknowledged'
  ).length;
  const allAcknowledged = acknowledgedCount === utilities.length;

  const handleAcknowledge = (id: string) => {
    setUtilities((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: 'acknowledged' as const } : u
      )
    );
    // Auto-expand next
    const currentIdx = utilities.findIndex((u) => u.id === id);
    const next = utilities[currentIdx + 1];
    if (next && next.status === 'pending') {
      setExpandedId(next.id);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    logCopyMutation.mutate({ text });
  };

  const handleContinue = async () => {
    setIsSubmitting(true);

    try {
      await api.onboarding.updateStep('utilities', {
        acknowledged: utilities.map((u) => u.id),
      });
    } catch {
      setSaveWarning('Your progress may not have been saved. You can continue.');
    }

    const progress = JSON.parse(
      localStorage.getItem('onboarding_progress') || '{}'
    );
    progress.utilities = 'completed';
    localStorage.setItem('onboarding_progress', JSON.stringify(progress));

    setIsSubmitting(false);
    router.push('/onboarding/orientation');
  };

  return (
    <>
      <PageHeader title="Utilities Setup" showBack />

      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Progress */}
        <div className="card p-4 bg-primary-50 border-primary-100">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-primary-700 font-medium">
              Utilities Review
            </span>
            <span className="text-primary-600">
              {acknowledgedCount} of {utilities.length} reviewed
            </span>
          </div>
          <div className="h-2 bg-primary-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-300"
              style={{
                width: `${(acknowledgedCount / utilities.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <Info className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
          <p>
            Review the utility setup instructions for your unit. You&apos;ll
            need this information to manage your electricity, water, and gas.
          </p>
        </div>

        {/* Utility Cards */}
        <div className="space-y-4">
          {utilities.map((utility) => {
            const Icon = utility.icon;
            const isExpanded = expandedId === utility.id;
            const isAcknowledged = utility.status === 'acknowledged';

            return (
              <div key={utility.id} className="card overflow-hidden">
                {/* Header */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : utility.id)
                  }
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  <div
                    className={`p-2.5 rounded-xl ${
                      isAcknowledged ? 'bg-success-50' : 'bg-gray-100'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        isAcknowledged ? 'text-success-600' : 'text-gray-600'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{utility.name}</h3>
                      {isAcknowledged && (
                        <Check className="w-4 h-4 text-success-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {utility.description}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* Meter/Account info */}
                    {utility.meterNumber && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1">
                          {utility.accountInfo || 'Account Info'}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-sm">
                            {utility.meterNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(utility.meterNumber!)
                            }
                            className="btn text-xs bg-gray-200 text-gray-700 px-2 py-1 flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedText === utility.meterNumber
                              ? 'Copied!'
                              : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Instructions */}
                    <div className="space-y-4">
                      {utility.instructions.map((instruction) => (
                        <div
                          key={instruction.step}
                          className="flex gap-3"
                        >
                          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-medium text-primary-600">
                              {instruction.step}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium mb-1">
                              {instruction.title}
                            </h4>
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {instruction.content}
                            </p>
                            {instruction.action && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (instruction.action!.type === 'copy') {
                                    handleCopy(instruction.action!.value);
                                  }
                                }}
                                className="mt-2 btn text-xs bg-primary-50 text-primary-600 px-3 py-1.5 flex items-center gap-1.5"
                              >
                                {instruction.action.type === 'copy' ? (
                                  <Copy className="w-3 h-3" />
                                ) : (
                                  <ExternalLink className="w-3 h-3" />
                                )}
                                {copiedText === instruction.action.value
                                  ? 'Copied!'
                                  : instruction.action.label}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Acknowledge button */}
                    {!isAcknowledged && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(utility.id)}
                        className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        I&apos;ve reviewed this
                      </button>
                    )}

                    {isAcknowledged && (
                      <div className="flex items-center justify-center gap-2 text-sm text-success-600 font-medium py-2">
                        <Check className="w-4 h-4" />
                        Reviewed
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        {saveWarning && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {saveWarning}
          </div>
        )}
        <button
          onClick={handleContinue}
          disabled={!allAcknowledged || isSubmitting}
          className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </>
  );
}
