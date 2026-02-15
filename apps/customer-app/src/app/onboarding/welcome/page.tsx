'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  MessageCircle,
  Phone,
  Mail,
  Bell,
  ChevronRight,
  Check,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'sw', label: 'Kiswahili', flag: '🇹🇿' },
];

const CHANNELS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'Get updates via WhatsApp messages',
    icon: MessageCircle,
    recommended: true,
  },
  {
    id: 'sms',
    label: 'SMS',
    description: 'Standard text message notifications',
    icon: Phone,
    recommended: false,
  },
  {
    id: 'email',
    label: 'Email',
    description: 'Receive detailed email notifications',
    icon: Mail,
    recommended: false,
  },
  {
    id: 'push',
    label: 'Push Notifications',
    description: 'In-app push notifications',
    icon: Bell,
    recommended: false,
  },
];

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [language, setLanguage] = useState('en');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['whatsapp']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((c) => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handleContinue = async () => {
    if (selectedChannels.length === 0) return;

    setIsSubmitting(true);

    try {
      await api.onboarding.updateStep('welcome', {
        language,
        preferredChannels: selectedChannels,
      });
    } catch {
      // Continue even if API fails
    }

    // Save progress locally
    const progress = JSON.parse(
      localStorage.getItem('onboarding_progress') || '{}'
    );
    progress.welcome = 'completed';
    progress.preferences = { language, channels: selectedChannels };
    localStorage.setItem('onboarding_progress', JSON.stringify(progress));

    setIsSubmitting(false);
    router.push('/onboarding/documents');
  };

  return (
    <>
      {/* Hero Header */}
      <header className="bg-gradient-to-br from-primary-600 to-primary-700 text-white px-4 pt-10 pb-14 rounded-b-3xl relative overflow-hidden">
        <div className="relative z-10 max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            Karibu, {user?.firstName || 'there'}!
          </h1>
          <p className="text-primary-100 text-sm leading-relaxed">
            Welcome to your new home. Let&apos;s set up your account
            in just a few steps so you can get the most out of BOSSNYUMBA.
          </p>
        </div>
        {/* Decorative */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-16 -left-8 w-48 h-48 bg-white/5 rounded-full" />
      </header>

      <div className="px-4 -mt-6 pb-32 max-w-md mx-auto space-y-6">
        {/* Language Selection */}
        <section className="card p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Globe className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold">Preferred Language</h2>
              <p className="text-sm text-gray-500">
                Choose your communication language
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`card p-4 text-center transition-all ${
                  language === lang.code
                    ? 'ring-2 ring-primary-500 bg-primary-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl mb-1 block">{lang.flag}</span>
                <span className="text-sm font-medium">{lang.label}</span>
                {language === lang.code && (
                  <Check className="w-4 h-4 text-primary-500 mx-auto mt-1" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Channel Preferences */}
        <section className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary-50 rounded-lg">
              <MessageCircle className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold">Communication Channels</h2>
              <p className="text-sm text-gray-500">
                How would you like to receive updates?
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {CHANNELS.map((channel) => {
              const Icon = channel.icon;
              const isSelected = selectedChannels.includes(channel.id);

              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => toggleChannel(channel.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-primary-50 ring-2 ring-primary-500'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-primary-100' : 'bg-gray-200'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        isSelected ? 'text-primary-600' : 'text-gray-500'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {channel.label}
                      </span>
                      {channel.recommended && (
                        <span className="badge-success text-[10px]">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {channel.description}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-primary-500 border-primary-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* What to expect */}
        <section className="card p-4 bg-gray-50 border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            What&apos;s Next?
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            {[
              'Upload your ID and documents',
              'Set up your utilities (TANESCO/LUKU, water)',
              'Review house rules',
              'Complete move-in inspection',
              'Sign your lease digitally',
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-medium text-primary-600">
                    {idx + 1}
                  </span>
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <button
          onClick={handleContinue}
          disabled={selectedChannels.length === 0 || isSubmitting}
          className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Get Started
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </>
  );
}
