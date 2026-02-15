import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, Search, Plus, AlertTriangle, Users, Building2 } from 'lucide-react';

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  scope: 'global' | 'tenant' | 'user';
  affectedTenants: number;
  updatedAt: string;
  updatedBy: string;
}

const mockFlags: FeatureFlag[] = [
  { id: '1', name: 'AI Auto-Categorization', key: 'ai_auto_categorize', description: 'Enable AI-powered auto-categorization of maintenance requests', enabled: true, scope: 'global', affectedTenants: 118, updatedAt: '2026-02-10', updatedBy: 'admin@bossnyumba.com' },
  { id: '2', name: 'M-Pesa STK Push', key: 'mpesa_stk_push', description: 'Enable direct M-Pesa STK push for rent collection', enabled: true, scope: 'global', affectedTenants: 118, updatedAt: '2026-02-08', updatedBy: 'admin@bossnyumba.com' },
  { id: '3', name: 'Bulk SMS Campaigns', key: 'bulk_sms', description: 'Allow tenants to send bulk SMS campaigns to residents', enabled: false, scope: 'tenant', affectedTenants: 12, updatedAt: '2026-02-05', updatedBy: 'admin@bossnyumba.com' },
  { id: '4', name: 'Advanced Analytics', key: 'advanced_analytics', description: 'Enable advanced analytics dashboard for enterprise tenants', enabled: true, scope: 'tenant', affectedTenants: 45, updatedAt: '2026-01-28', updatedBy: 'admin@bossnyumba.com' },
  { id: '5', name: 'E-Signature', key: 'e_signature', description: 'Enable electronic signature for lease agreements', enabled: false, scope: 'global', affectedTenants: 0, updatedAt: '2026-01-20', updatedBy: 'admin@bossnyumba.com' },
  { id: '6', name: 'Smart Rent Pricing', key: 'smart_pricing', description: 'AI-powered rent pricing recommendations based on market data', enabled: false, scope: 'tenant', affectedTenants: 5, updatedAt: '2026-01-15', updatedBy: 'admin@bossnyumba.com' },
];

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState(mockFlags);
  const [search, setSearch] = useState('');

  const toggleFlag = (id: string) => {
    setFlags(flags.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
  };

  const filtered = flags.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()) || f.key.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-sm text-gray-500 mt-1">Control feature rollout across the platform</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
          <Plus className="h-4 w-4" />
          New Flag
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" placeholder="Search flags..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
      </div>

      <div className="space-y-3">
        {filtered.map((flag) => (
          <div key={flag.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900">{flag.name}</h3>
                  <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{flag.key}</code>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${flag.scope === 'global' ? 'bg-blue-100 text-blue-700' : flag.scope === 'tenant' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-700'}`}>{flag.scope}</span>
                </div>
                <p className="text-sm text-gray-500 mb-2">{flag.description}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{flag.affectedTenants} tenants</span>
                  <span>Updated {flag.updatedAt}</span>
                  <span>by {flag.updatedBy}</span>
                </div>
              </div>
              <button onClick={() => toggleFlag(flag.id)} className="flex-shrink-0 ml-4">
                {flag.enabled ? <ToggleRight className="h-8 w-8 text-violet-600" /> : <ToggleLeft className="h-8 w-8 text-gray-400" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
