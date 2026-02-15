import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Building2,
  MessageSquare,
  Phone,
  Mail,
  X,
  ChevronRight,
  Search,
  Filter,
  ExternalLink,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { formatDateTime } from '../../lib/api';

// ─── Types ─────────────────────────────────────────────────

interface EscalationCase {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  tenant: string;
  requester: { name: string; email: string };
  priority: 'low' | 'medium' | 'high' | 'critical';
  currentLevel: number;
  maxLevel: number;
  status: 'pending_escalation' | 'escalated' | 'in_review' | 'resolved' | 'de_escalated';
  assignedTeam: string;
  escalationHistory: {
    level: number;
    team: string;
    escalatedBy: string;
    reason: string;
    timestamp: string;
  }[];
  slaDeadline: string;
  slaBreached: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Mock Data ─────────────────────────────────────────────

const mockCases: EscalationCase[] = [
  {
    id: '1', ticketNumber: 'SUP-2026-0142', subject: 'M-Pesa Payment Failures - Critical', description: 'Multiple tenants unable to process M-Pesa payments. Affecting 23 pending transactions totaling KES 890,000.', tenant: 'Acme Properties Ltd', requester: { name: 'John Kamau', email: 'john@acme.co.ke' }, priority: 'critical', currentLevel: 3, maxLevel: 4, status: 'escalated', assignedTeam: 'Engineering Lead', escalationHistory: [
      { level: 1, team: 'Support L1', escalatedBy: 'auto', reason: 'SLA breached - no response in 1 hour', timestamp: '2026-02-13T09:00:00Z' },
      { level: 2, team: 'Support L2', escalatedBy: 'Mary W.', reason: 'Payment gateway integration issue', timestamp: '2026-02-13T10:00:00Z' },
      { level: 3, team: 'Engineering Lead', escalatedBy: 'John K.', reason: 'Requires infrastructure intervention', timestamp: '2026-02-13T11:00:00Z' },
    ], slaDeadline: '2026-02-13T15:00:00Z', slaBreached: false, createdAt: '2026-02-13T08:00:00Z', updatedAt: '2026-02-13T11:00:00Z',
  },
  {
    id: '2', ticketNumber: 'SUP-2026-0139', subject: 'Billing Discrepancy - Overcharged', description: 'Charged for 50 units but tenant only has 38 active units. Discrepancy of KES 180,000.', tenant: 'Coastal Estates', requester: { name: 'Fatma Hassan', email: 'fatma@coastal.co.ke' }, priority: 'high', currentLevel: 2, maxLevel: 4, status: 'in_review', assignedTeam: 'Billing Team', escalationHistory: [
      { level: 1, team: 'Support L1', escalatedBy: 'auto', reason: 'Billing issue flagged by customer', timestamp: '2026-02-10T12:00:00Z' },
      { level: 2, team: 'Billing Team', escalatedBy: 'Support L1', reason: 'Requires billing system investigation', timestamp: '2026-02-11T09:00:00Z' },
    ], slaDeadline: '2026-02-14T12:00:00Z', slaBreached: false, createdAt: '2026-02-10T11:00:00Z', updatedAt: '2026-02-11T09:00:00Z',
  },
  {
    id: '3', ticketNumber: 'SUP-2026-0135', subject: 'Data Export Not Working', description: 'Customer unable to export financial reports. Reports page throws 500 error.', tenant: 'Highland Properties', requester: { name: 'David Kipchoge', email: 'david@highland.co.ke' }, priority: 'medium', currentLevel: 1, maxLevel: 4, status: 'pending_escalation', assignedTeam: 'Support L1', escalationHistory: [], slaDeadline: '2026-02-14T08:00:00Z', slaBreached: false, createdAt: '2026-02-12T08:00:00Z', updatedAt: '2026-02-12T08:00:00Z',
  },
  {
    id: '4', ticketNumber: 'SUP-2026-0130', subject: 'Account Recovery Request', description: 'Locked out of admin account. Need password reset and 2FA reconfiguration.', tenant: 'Sunrise Realty', requester: { name: 'Mary Wanjiku', email: 'mary@sunrise.co.ke' }, priority: 'high', currentLevel: 2, maxLevel: 4, status: 'resolved', assignedTeam: 'Security Team', escalationHistory: [
      { level: 1, team: 'Support L1', escalatedBy: 'auto', reason: 'Security-related account issue', timestamp: '2026-02-09T14:00:00Z' },
      { level: 2, team: 'Security Team', escalatedBy: 'Support L1', reason: 'Requires identity verification', timestamp: '2026-02-09T15:00:00Z' },
    ], slaDeadline: '2026-02-10T14:00:00Z', slaBreached: false, createdAt: '2026-02-09T13:00:00Z', updatedAt: '2026-02-10T10:00:00Z',
  },
];

const escalationTeams = ['Support L1', 'Support L2', 'Billing Team', 'Engineering Lead', 'Security Team', 'Executive'];
const priorityColors: Record<string, string> = { low: 'bg-gray-100 text-gray-700', medium: 'bg-blue-100 text-blue-700', high: 'bg-amber-100 text-amber-700', critical: 'bg-red-100 text-red-700' };
const statusColors: Record<string, string> = { pending_escalation: 'bg-amber-100 text-amber-700', escalated: 'bg-red-100 text-red-700', in_review: 'bg-blue-100 text-blue-700', resolved: 'bg-green-100 text-green-700', de_escalated: 'bg-gray-100 text-gray-700' };

// ─── Component ─────────────────────────────────────────────

export default function Escalation() {
  const navigate = useNavigate();
  const [cases, setCases] = useState(mockCases);
  const [selectedCase, setSelectedCase] = useState<EscalationCase | null>(null);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateTeam, setEscalateTeam] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredCases = cases.filter((c) => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesSearch = c.subject.toLowerCase().includes(search.toLowerCase()) || c.ticketNumber.toLowerCase().includes(search.toLowerCase()) || c.tenant.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleEscalate = () => {
    if (!selectedCase || !escalateReason || !escalateTeam) return;
    const newLevel = selectedCase.currentLevel + 1;
    const updated = {
      ...selectedCase,
      currentLevel: newLevel,
      status: 'escalated' as const,
      assignedTeam: escalateTeam,
      escalationHistory: [...selectedCase.escalationHistory, { level: newLevel, team: escalateTeam, escalatedBy: 'admin@bossnyumba.com', reason: escalateReason, timestamp: new Date().toISOString() }],
    };
    setCases(cases.map((c) => (c.id === selectedCase.id ? updated : c)));
    setSelectedCase(updated);
    setShowEscalateModal(false);
    setEscalateReason('');
    setEscalateTeam('');
    setNotification({ type: 'success', message: `Case ${selectedCase.ticketNumber} escalated to Level ${newLevel} (${escalateTeam})` });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleResolve = (caseItem: EscalationCase) => {
    setCases(cases.map((c) => (c.id === caseItem.id ? { ...c, status: 'resolved' as const } : c)));
    if (selectedCase?.id === caseItem.id) setSelectedCase({ ...caseItem, status: 'resolved' });
    setNotification({ type: 'success', message: `Case ${caseItem.ticketNumber} marked as resolved` });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/support')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Case Escalation</h1>
            <p className="text-sm text-gray-500 mt-1">Manage escalation workflows for support cases</p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{cases.length}</p>
          <p className="text-sm text-gray-500">Total Cases</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-red-600">{cases.filter((c) => c.status === 'escalated').length}</p>
          <p className="text-sm text-gray-500">Escalated</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{cases.filter((c) => c.status === 'pending_escalation').length}</p>
          <p className="text-sm text-gray-500">Pending</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{cases.filter((c) => c.status === 'in_review').length}</p>
          <p className="text-sm text-gray-500">In Review</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-red-600">{cases.filter((c) => c.slaBreached).length}</p>
          <p className="text-sm text-gray-500">SLA Breached</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search cases..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
          <option value="all">All Status</option>
          <option value="pending_escalation">Pending Escalation</option>
          <option value="escalated">Escalated</option>
          <option value="in_review">In Review</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Cases grid + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Cases List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredCases.map((c) => (
            <button key={c.id} onClick={() => setSelectedCase(c)} className={`w-full text-left bg-white rounded-xl border p-4 hover:shadow-sm transition-all ${selectedCase?.id === c.id ? 'border-violet-300 ring-1 ring-violet-200' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">{c.ticketNumber}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityColors[c.priority]}`}>{c.priority}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[c.status]}`}>{c.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="font-medium text-gray-900 text-sm mb-1">{c.subject}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{c.tenant}</span>
                <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" />Level {c.currentLevel}</span>
              </div>
              {/* Escalation level indicator */}
              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: c.maxLevel }).map((_, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full ${i < c.currentLevel ? 'bg-red-400' : 'bg-gray-200'}`} />
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Case Detail */}
        <div className="lg:col-span-3">
          {selectedCase ? (
            <div className="bg-white rounded-xl border border-gray-200">
              {/* Case header */}
              <div className="p-5 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-500">{selectedCase.ticketNumber}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityColors[selectedCase.priority]}`}>{selectedCase.priority}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[selectedCase.status]}`}>{selectedCase.status.replace(/_/g, ' ')}</span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedCase.subject}</h2>
                    <p className="text-sm text-gray-600 mt-1">{selectedCase.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-400 mt-3">
                      <span className="flex items-center gap-1"><Building2 className="h-4 w-4" />{selectedCase.tenant}</span>
                      <span className="flex items-center gap-1"><Users className="h-4 w-4" />{selectedCase.requester.name}</span>
                      <span className="flex items-center gap-1"><Shield className="h-4 w-4" />Assigned: {selectedCase.assignedTeam}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">Level {selectedCase.currentLevel}/{selectedCase.maxLevel}</p>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      {Array.from({ length: selectedCase.maxLevel }).map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full ${i < selectedCase.currentLevel ? 'bg-red-400' : 'bg-gray-200'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SLA Info */}
              <div className={`px-5 py-3 ${selectedCase.slaBreached ? 'bg-red-50 border-b border-red-200' : 'bg-gray-50 border-b border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className={`h-4 w-4 ${selectedCase.slaBreached ? 'text-red-600' : 'text-gray-500'}`} />
                    <span className={`text-sm font-medium ${selectedCase.slaBreached ? 'text-red-700' : 'text-gray-700'}`}>
                      SLA Deadline: {new Date(selectedCase.slaDeadline).toLocaleString()}
                    </span>
                    {selectedCase.slaBreached && <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">BREACHED</span>}
                  </div>
                </div>
              </div>

              {/* Escalation Timeline */}
              <div className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Escalation History</h3>
                {selectedCase.escalationHistory.length > 0 ? (
                  <div className="relative">
                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
                    <div className="space-y-4">
                      {selectedCase.escalationHistory.map((entry, idx) => (
                        <div key={idx} className="relative pl-9">
                          <div className="absolute left-0.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                            <ArrowUp className="h-3 w-3 text-red-600" />
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-900 text-sm">Level {entry.level}: {entry.team}</span>
                              <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-gray-600">Reason: {entry.reason}</p>
                            <p className="text-xs text-gray-400 mt-1">Escalated by: {entry.escalatedBy}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No escalation history yet</p>
                )}
              </div>

              {/* Actions */}
              {selectedCase.status !== 'resolved' && (
                <div className="px-5 pb-5 flex items-center gap-3">
                  {selectedCase.currentLevel < selectedCase.maxLevel && (
                    <button onClick={() => { setShowEscalateModal(true); setEscalateTeam(escalationTeams[selectedCase.currentLevel] || ''); }} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm">
                      <ArrowUp className="h-4 w-4" />
                      Escalate to Level {selectedCase.currentLevel + 1}
                    </button>
                  )}
                  <button onClick={() => handleResolve(selectedCase)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm">
                    <CheckCircle className="h-4 w-4" />
                    Resolve
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <ArrowUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Select a case to view escalation details</p>
            </div>
          )}
        </div>
      </div>

      {/* Escalate Modal */}
      {showEscalateModal && selectedCase && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowEscalateModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Escalate Case</h3>
                <button onClick={() => setShowEscalateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5 text-gray-500" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">Escalating <span className="font-bold">{selectedCase.ticketNumber}</span> from Level {selectedCase.currentLevel} to Level {selectedCase.currentLevel + 1}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Escalate To</label>
                  <select value={escalateTeam} onChange={(e) => setEscalateTeam(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
                    {escalationTeams.map((team) => <option key={team} value={team}>{team}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Escalation *</label>
                  <textarea value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} placeholder="Why is this case being escalated?" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 resize-none" rows={3} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button onClick={() => setShowEscalateModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button onClick={handleEscalate} disabled={!escalateReason} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50">
                  <ArrowUp className="h-4 w-4" />
                  Escalate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
