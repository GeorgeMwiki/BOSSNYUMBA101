import React, { useEffect, useMemo, useState } from 'react';
import {
  Settings,
  Globe,
  CreditCard,
  Shield,
  Save,
  ChevronRight,
  AlertTriangle,
  Flag,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  useSystemConfiguration,
  useUpdateSystemConfiguration,
  useUpdateFeatureFlag,
  validateSystemConfiguration,
  type FeatureFlag,
  type UpdateSystemConfigurationInput,
} from '../lib/api/configuration';
import { useToast } from '../components/ui/Toast';

type SectionId = 'general' | 'rates' | 'feature-flags' | 'security';

interface Section {
  id: SectionId;
  name: string;
  description: string;
  icon: React.ElementType;
}

const sections: Section[] = [
  { id: 'general', name: 'General Settings', description: 'Platform name, timezone, currency', icon: Globe },
  { id: 'rates', name: 'Rates & Grace Periods', description: 'Late fees, trial and payment retry limits', icon: CreditCard },
  { id: 'feature-flags', name: 'Feature Flags', description: 'Enable or disable platform capabilities', icon: Flag },
  { id: 'security', name: 'Security', description: 'Session and policy controls', icon: Shield },
];

export function ConfigurationPage() {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useSystemConfiguration();
  const updateCfg = useUpdateSystemConfiguration();
  const updateFlag = useUpdateFeatureFlag();

  const [active, setActive] = useState<SectionId>('general');
  const [patch, setPatch] = useState<UpdateSystemConfigurationInput>({});

  useEffect(() => {
    setPatch({});
  }, [data?.platformName]);

  const merged = useMemo(() => ({ ...(data ?? null), ...patch, rates: { ...(data?.rates ?? {}), ...(patch.rates ?? {}) } }), [data, patch]);
  const errors = useMemo(() => validateSystemConfiguration(patch), [patch]);
  const hasChanges = Object.keys(patch).length > 0;

  const setField = <K extends keyof UpdateSystemConfigurationInput>(k: K, v: UpdateSystemConfigurationInput[K]) => {
    setPatch((p) => ({ ...p, [k]: v }));
  };

  const setRate = <K extends keyof NonNullable<UpdateSystemConfigurationInput['rates']>>(k: K, v: number) => {
    setPatch((p) => ({ ...p, rates: { ...(p.rates ?? {}), [k]: v } }));
  };

  const save = async () => {
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    try {
      await updateCfg.mutateAsync(patch);
      toast.success('Configuration saved');
      setPatch({});
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-red-800">Failed to load configuration</p>
          <p className="text-sm text-red-700 mt-1">{(error as Error)?.message || 'Unknown error'}</p>
          <button onClick={() => refetch()} className="mt-3 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const cfg = merged;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
          <p className="text-gray-500">Manage platform-wide settings</p>
        </div>
        {hasChanges && (
          <button
            onClick={save}
            disabled={updateCfg.isPending || errors.length > 0}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {updateCfg.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        )}
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
          <ul className="text-sm text-red-800 list-disc pl-4 space-y-0.5">
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-fit">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Settings</h2>
          </div>
          <nav className="divide-y divide-gray-100">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 ${active === s.id ? 'bg-violet-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${active === s.id ? 'bg-violet-100' : 'bg-gray-100'}`}>
                    <s.icon className={`h-4 w-4 ${active === s.id ? 'text-violet-600' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${active === s.id ? 'text-violet-600' : 'text-gray-900'}`}>{s.name}</p>
                    <p className="text-xs text-gray-500">{s.description}</p>
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 ${active === s.id ? 'text-violet-600' : 'text-gray-400'}`} />
              </button>
            ))}
          </nav>
        </div>

        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            {sections.find((s) => s.id === active)?.name}
          </h2>

          {active === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Platform Name</label>
                <input
                  type="text"
                  value={cfg.platformName ?? ''}
                  onChange={(e) => setField('platformName', e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Timezone</label>
                <select
                  value={cfg.defaultTimezone ?? 'Africa/Nairobi'}
                  onChange={(e) => setField('defaultTimezone', e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                  <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                  <option value="Africa/Cairo">Africa/Cairo (EET)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Currency</label>
                <select
                  value={cfg.defaultCurrency ?? 'KES'}
                  onChange={(e) => setField('defaultCurrency', e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="KES">Kenyan Shilling (KES)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="UGX">Ugandan Shilling (UGX)</option>
                  <option value="TZS">Tanzanian Shilling (TZS)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Language</label>
                <select
                  value={cfg.defaultLanguage ?? 'en'}
                  onChange={(e) => setField('defaultLanguage', e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="en">English</option>
                  <option value="sw">Swahili</option>
                  <option value="fr">French</option>
                </select>
              </div>
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={cfg.allowTenantRegistration ?? true}
                    onChange={(e) => setField('allowTenantRegistration', e.target.checked)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Allow new tenant registrations</span>
                    <p className="text-sm text-gray-500">Enable self-service tenant sign-up</p>
                  </div>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={cfg.enableTrialPeriod ?? true}
                    onChange={(e) => setField('enableTrialPeriod', e.target.checked)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Enable trial period</span>
                    <p className="text-sm text-gray-500">Grant new tenants a free trial</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {active === 'rates' && (
            <div className="space-y-6">
              <NumberField
                label="Late fee percentage"
                help="Applied to overdue balances. Between 0 and 100."
                value={cfg.rates?.lateFeePct ?? 0}
                onChange={(v) => setRate('lateFeePct', v)}
                suffix="%"
                min={0}
                max={100}
                step={0.1}
              />
              <NumberField
                label="Late fee grace period"
                help="Days before a late fee is applied."
                icon={Clock}
                value={cfg.rates?.lateFeeGraceDays ?? 0}
                onChange={(v) => setRate('lateFeeGraceDays', v)}
                suffix="days"
                min={0}
                max={90}
              />
              <NumberField
                label="Trial period"
                help="Trial length granted to new tenants."
                value={cfg.rates?.trialDays ?? 0}
                onChange={(v) => setRate('trialDays', v)}
                suffix="days"
                min={0}
                max={90}
              />
              <NumberField
                label="Max payment retries"
                help="Number of automatic retries for failed payments."
                value={cfg.rates?.paymentRetries ?? 0}
                onChange={(v) => setRate('paymentRetries', v)}
                min={0}
                max={10}
              />
            </div>
          )}

          {active === 'feature-flags' && (
            <div className="space-y-3">
              {(cfg.featureFlags ?? []).length === 0 && (
                <p className="text-sm text-gray-500">No feature flags configured.</p>
              )}
              {(cfg.featureFlags ?? []).map((flag: FeatureFlag) => (
                <FeatureFlagRow
                  key={flag.key}
                  flag={flag}
                  saving={updateFlag.isPending}
                  onToggle={async (enabled) => {
                    try {
                      await updateFlag.mutateAsync({ key: flag.key, enabled });
                      toast.success(`${flag.name} ${enabled ? 'enabled' : 'disabled'}`);
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                />
              ))}
            </div>
          )}

          {active === 'security' && (
            <div className="space-y-6">
              <NumberField
                label="Session timeout"
                help="Minutes until an idle session expires. 5 to 1440."
                value={cfg.rates?.sessionTimeoutMinutes ?? 60}
                onChange={(v) => setRate('sessionTimeoutMinutes', v)}
                suffix="min"
                min={5}
                max={1440}
              />
              <p className="text-sm text-gray-500">Password policies and 2FA are managed per-tenant in the Roles area.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label, help, value, onChange, min, max, step, suffix, icon: Icon,
}: {
  label: string;
  help?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  icon?: React.ElementType;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-gray-500" /> : null}
        {label}
      </label>
      {help && <p className="text-xs text-gray-500 mb-2">{help}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step ?? 1}
          className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

function FeatureFlagRow({ flag, saving, onToggle }: { flag: FeatureFlag; saving: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
      <div>
        <p className="font-medium text-gray-900">{flag.name}</p>
        <p className="text-xs text-gray-500 font-mono">{flag.key}</p>
        {flag.description && <p className="text-sm text-gray-600 mt-1">{flag.description}</p>}
        {typeof flag.rolloutPct === 'number' && (
          <p className="text-xs text-gray-500 mt-1">Rollout: {flag.rolloutPct}%</p>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={flag.enabled}
          disabled={saving}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-violet-600 peer-disabled:opacity-50 peer-focus:ring-2 peer-focus:ring-violet-300 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
      </label>
    </div>
  );
}
