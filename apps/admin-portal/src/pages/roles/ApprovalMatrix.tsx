import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  Edit,
  X,
  CheckCircle,
  AlertTriangle,
  Users,
  DollarSign,
  Wrench,
  FileText,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────

interface ApprovalRule {
  id: string;
  name: string;
  category: string;
  description: string;
  trigger: string;
  thresholdType: 'amount' | 'count' | 'always';
  thresholdValue: number;
  thresholdCurrency?: string;
  approvers: { level: number; role: string; requiredCount: number; autoApproveAfterHours: number }[];
  escalationHours: number;
  autoRejectAfterHours: number;
  isActive: boolean;
}

const categoryIcons: Record<string, React.ElementType> = {
  finance: DollarSign,
  maintenance: Wrench,
  leasing: FileText,
  users: Users,
};

const initialRules: ApprovalRule[] = [
  {
    id: '1', name: 'High-Value Disbursement', category: 'finance', description: 'Requires approval for disbursements above threshold',
    trigger: 'disbursement.created', thresholdType: 'amount', thresholdValue: 100000, thresholdCurrency: 'KES',
    approvers: [
      { level: 1, role: 'Finance Manager', requiredCount: 1, autoApproveAfterHours: 0 },
      { level: 2, role: 'Finance Director', requiredCount: 1, autoApproveAfterHours: 0 },
    ],
    escalationHours: 24, autoRejectAfterHours: 72, isActive: true,
  },
  {
    id: '2', name: 'Maintenance Work Order > KES 50K', category: 'maintenance', description: 'Approval for expensive maintenance work',
    trigger: 'workorder.created', thresholdType: 'amount', thresholdValue: 50000, thresholdCurrency: 'KES',
    approvers: [{ level: 1, role: 'Operations Lead', requiredCount: 1, autoApproveAfterHours: 48 }],
    escalationHours: 12, autoRejectAfterHours: 48, isActive: true,
  },
  {
    id: '3', name: 'Lease Termination', category: 'leasing', description: 'All lease terminations require approval',
    trigger: 'lease.terminate', thresholdType: 'always', thresholdValue: 0,
    approvers: [
      { level: 1, role: 'Property Manager', requiredCount: 1, autoApproveAfterHours: 0 },
      { level: 2, role: 'Operations Lead', requiredCount: 1, autoApproveAfterHours: 0 },
    ],
    escalationHours: 48, autoRejectAfterHours: 168, isActive: true,
  },
  {
    id: '4', name: 'Rent Adjustment > 10%', category: 'finance', description: 'Significant rent changes need approval',
    trigger: 'rent.adjustment', thresholdType: 'amount', thresholdValue: 10, thresholdCurrency: '%',
    approvers: [{ level: 1, role: 'Finance Manager', requiredCount: 1, autoApproveAfterHours: 0 }],
    escalationHours: 24, autoRejectAfterHours: 72, isActive: true,
  },
  {
    id: '5', name: 'New User Creation', category: 'users', description: 'New admin users require approval',
    trigger: 'user.create_admin', thresholdType: 'always', thresholdValue: 0,
    approvers: [{ level: 1, role: 'Super Admin', requiredCount: 1, autoApproveAfterHours: 0 }],
    escalationHours: 12, autoRejectAfterHours: 48, isActive: false,
  },
];

// ─── Component ─────────────────────────────────────────────

export default function ApprovalMatrix() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<ApprovalRule[]>(initialRules);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState<ApprovalRule | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedRule(expandedRule === id ? null : id);
  };

  const toggleActive = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)));
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
    setNotification({ type: 'success', message: 'Approval rule deleted' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSaving(false);
    setNotification({ type: 'success', message: 'Approval matrix saved successfully' });
    setTimeout(() => setNotification(null), 3000);
  };

  const addNewRule = () => {
    const newRule: ApprovalRule = {
      id: String(Date.now()),
      name: 'New Approval Rule',
      category: 'finance',
      description: '',
      trigger: '',
      thresholdType: 'amount',
      thresholdValue: 0,
      thresholdCurrency: 'KES',
      approvers: [{ level: 1, role: 'Finance Manager', requiredCount: 1, autoApproveAfterHours: 0 }],
      escalationHours: 24,
      autoRejectAfterHours: 72,
      isActive: false,
    };
    setRules([...rules, newRule]);
    setExpandedRule(newRule.id);
  };

  const updateRule = (id: string, updates: Partial<ApprovalRule>) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const addApproverLevel = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;
    const newLevel = rule.approvers.length + 1;
    updateRule(ruleId, {
      approvers: [...rule.approvers, { level: newLevel, role: 'Finance Manager', requiredCount: 1, autoApproveAfterHours: 0 }],
    });
  };

  const removeApproverLevel = (ruleId: string, level: number) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule || rule.approvers.length <= 1) return;
    updateRule(ruleId, {
      approvers: rule.approvers.filter((a) => a.level !== level).map((a, i) => ({ ...a, level: i + 1 })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/roles')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Approval Matrix</h1>
            <p className="text-sm text-gray-500 mt-1">Configure who can approve what, and at what thresholds</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={addNewRule} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Plus className="h-4 w-4" />
            Add Rule
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
            {saving ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
            <span className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{rules.length}</p>
          <p className="text-sm text-gray-500">Total Rules</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600">{rules.filter((r) => r.isActive).length}</p>
          <p className="text-sm text-gray-500">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{rules.filter((r) => !r.isActive).length}</p>
          <p className="text-sm text-gray-500">Inactive</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-violet-600">{new Set(rules.flatMap((r) => r.approvers.map((a) => a.role))).size}</p>
          <p className="text-sm text-gray-500">Approver Roles</p>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.map((rule) => {
          const Icon = categoryIcons[rule.category] || Shield;
          const isExpanded = expandedRule === rule.id;

          return (
            <div key={rule.id} className={`bg-white rounded-xl border ${rule.isActive ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-75'} overflow-hidden`}>
              {/* Rule header */}
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(rule.id)}>
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-violet-100' : 'bg-gray-100'}`}>
                    <Icon className={`h-5 w-5 ${rule.isActive ? 'text-violet-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-violet-100 text-violet-700">{rule.category}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{rule.description || 'No description'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right mr-4">
                    <p className="text-sm font-medium text-gray-700">
                      {rule.thresholdType === 'always' ? 'Always requires approval' : `Threshold: ${rule.thresholdValue} ${rule.thresholdCurrency || ''}`}
                    </p>
                    <p className="text-xs text-gray-400">{rule.approvers.length} approval level{rule.approvers.length > 1 ? 's' : ''}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-gray-200 p-5 space-y-5">
                  {/* Rule Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                      <input type="text" value={rule.name} onChange={(e) => updateRule(rule.id, { name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select value={rule.category} onChange={(e) => updateRule(rule.id, { category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
                        <option value="finance">Finance</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="leasing">Leasing</option>
                        <option value="users">Users</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trigger</label>
                      <input type="text" value={rule.trigger} onChange={(e) => updateRule(rule.id, { trigger: e.target.value })} placeholder="e.g., disbursement.created" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                    </div>
                  </div>

                  {/* Threshold */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Threshold Type</label>
                      <select value={rule.thresholdType} onChange={(e) => updateRule(rule.id, { thresholdType: e.target.value as 'amount' | 'count' | 'always' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
                        <option value="amount">Amount-based</option>
                        <option value="count">Count-based</option>
                        <option value="always">Always require</option>
                      </select>
                    </div>
                    {rule.thresholdType !== 'always' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Threshold Value</label>
                          <input type="number" value={rule.thresholdValue} onChange={(e) => updateRule(rule.id, { thresholdValue: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                          <select value={rule.thresholdCurrency} onChange={(e) => updateRule(rule.id, { thresholdCurrency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
                            <option value="KES">KES</option>
                            <option value="%">Percentage</option>
                            <option value="units">Units</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Approval Chain */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Approval Chain</h4>
                      <button onClick={() => addApproverLevel(rule.id)} className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700">
                        <Plus className="h-4 w-4" />Add Level
                      </button>
                    </div>
                    <div className="space-y-3">
                      {rule.approvers.map((approver, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-center w-8 h-8 bg-violet-600 text-white rounded-full text-sm font-bold">
                            {approver.level}
                          </div>
                          <div className="flex-1 grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Approver Role</label>
                              <select
                                value={approver.role}
                                onChange={(e) => {
                                  const newApprovers = [...rule.approvers];
                                  newApprovers[idx] = { ...newApprovers[idx], role: e.target.value };
                                  updateRule(rule.id, { approvers: newApprovers });
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                              >
                                <option value="Super Admin">Super Admin</option>
                                <option value="Finance Manager">Finance Manager</option>
                                <option value="Finance Director">Finance Director</option>
                                <option value="Operations Lead">Operations Lead</option>
                                <option value="Property Manager">Property Manager</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Required Approvals</label>
                              <input
                                type="number"
                                min={1}
                                value={approver.requiredCount}
                                onChange={(e) => {
                                  const newApprovers = [...rule.approvers];
                                  newApprovers[idx] = { ...newApprovers[idx], requiredCount: Number(e.target.value) };
                                  updateRule(rule.id, { approvers: newApprovers });
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Auto-approve after (hrs)</label>
                              <input
                                type="number"
                                min={0}
                                value={approver.autoApproveAfterHours}
                                onChange={(e) => {
                                  const newApprovers = [...rule.approvers];
                                  newApprovers[idx] = { ...newApprovers[idx], autoApproveAfterHours: Number(e.target.value) };
                                  updateRule(rule.id, { approvers: newApprovers });
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                              />
                            </div>
                          </div>
                          {rule.approvers.length > 1 && (
                            <button onClick={() => removeApproverLevel(rule.id, approver.level)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Escalation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Escalation after (hours)</label>
                      <input type="number" value={rule.escalationHours} onChange={(e) => updateRule(rule.id, { escalationHours: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Auto-reject after (hours)</label>
                      <input type="number" value={rule.autoRejectAfterHours} onChange={(e) => updateRule(rule.id, { autoRejectAfterHours: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <button onClick={() => toggleActive(rule.id)} className={`px-4 py-2 text-sm font-medium rounded-lg ${rule.isActive ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}>
                      {rule.isActive ? 'Deactivate Rule' : 'Activate Rule'}
                    </button>
                    <button onClick={() => deleteRule(rule.id)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                      Delete Rule
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No approval rules configured</p>
          <button onClick={addNewRule} className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">Add First Rule</button>
        </div>
      )}
    </div>
  );
}
