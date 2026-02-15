'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  Timer,
  BarChart3,
  ChevronRight,
  Loader2,
  Wrench,
  DollarSign,
  MessageSquare,
  Shield,
  XCircle,
  ArrowUpRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { slaService } from '@bossnyumba/api-client';

type SLACategoryTab = 'maintenance' | 'payments' | 'communications';
type Period = 'day' | 'week' | 'month' | 'quarter';

// ─── Fallback data for when the API is not available ───────────────────────

const fallbackMetrics = {
  period: { start: '', end: '' },
  overall: {
    responseComplianceRate: 94,
    resolutionComplianceRate: 87,
    averageResponseTimeMinutes: 92,
    averageResolutionTimeMinutes: 1080,
    totalWorkOrders: 101,
    completedWorkOrders: 86,
  },
  byPriority: {
    EMERGENCY: { count: 5, responseComplianceRate: 98, resolutionComplianceRate: 96, averageResponseTimeMinutes: 25, averageResolutionTimeMinutes: 150 },
    HIGH: { count: 23, responseComplianceRate: 92, resolutionComplianceRate: 88, averageResponseTimeMinutes: 90, averageResolutionTimeMinutes: 1080 },
    MEDIUM: { count: 45, responseComplianceRate: 89, resolutionComplianceRate: 84, averageResponseTimeMinutes: 320, averageResolutionTimeMinutes: 3120 },
    LOW: { count: 28, responseComplianceRate: 95, resolutionComplianceRate: 92, averageResponseTimeMinutes: 960, averageResolutionTimeMinutes: 7200 },
  },
  breaches: { responseBreaches: 4, resolutionBreaches: 7, escalations: 3 },
  trends: [
    { date: 'Mon', responseComplianceRate: 92, resolutionComplianceRate: 88 },
    { date: 'Tue', responseComplianceRate: 88, resolutionComplianceRate: 82 },
    { date: 'Wed', responseComplianceRate: 95, resolutionComplianceRate: 90 },
    { date: 'Thu', responseComplianceRate: 91, resolutionComplianceRate: 85 },
    { date: 'Fri', responseComplianceRate: 94, resolutionComplianceRate: 89 },
    { date: 'Sat', responseComplianceRate: 97, resolutionComplianceRate: 93 },
    { date: 'Sun', responseComplianceRate: 96, resolutionComplianceRate: 91 },
  ],
};

const fallbackHealth = {
  atRisk: [
    { workOrderId: 'wo-1', workOrderNumber: 'WO-2024-0045', title: 'Water heater issue', priority: 'HIGH' as const, type: 'resolution' as const, remainingMinutes: 42 },
    { workOrderId: 'wo-2', workOrderNumber: 'WO-2024-0048', title: 'Elevator noise', priority: 'MEDIUM' as const, type: 'response' as const, remainingMinutes: 18 },
  ],
  breached: [
    { workOrderId: 'wo-3', workOrderNumber: 'WO-2024-0039', title: 'Light fixture flickering', priority: 'LOW' as const, type: 'response' as const, breachMinutes: 135 },
    { workOrderId: 'wo-4', workOrderNumber: 'WO-2024-0035', title: 'Parking gate malfunction', priority: 'MEDIUM' as const, type: 'resolution' as const, breachMinutes: 270 },
  ],
};

// ─── Payment & Communication SLA mock data ─────────────────────────────────

const paymentSlaMetrics = {
  invoiceDeliveryRate: 98,
  paymentProcessingRate: 95,
  refundProcessingRate: 88,
  avgInvoiceDeliveryHours: 2,
  avgPaymentProcessingHours: 24,
  avgRefundProcessingDays: 3,
  overdueFollowUpRate: 91,
};

const communicationSlaMetrics = {
  firstResponseRate: 96,
  escalationResponseRate: 92,
  resolutionNotificationRate: 99,
  avgFirstResponseMinutes: 15,
  avgEscalationResponseMinutes: 45,
  ticketUpdateRate: 94,
};

// ─── SLA Targets ────────────────────────────────────────────────────────────

const priorityTargets: Record<string, { response: string; resolution: string; escalation: string }> = {
  EMERGENCY: { response: '30 min', resolution: '4 hours', escalation: '1 hour' },
  HIGH: { response: '2 hours', resolution: '24 hours', escalation: '4 hours' },
  MEDIUM: { response: '8 hours', resolution: '72 hours', escalation: '24 hours' },
  LOW: { response: '24 hours', resolution: '7 days', escalation: '48 hours' },
};

const priorityColors: Record<string, string> = {
  EMERGENCY: 'text-danger-600',
  HIGH: 'text-warning-600',
  MEDIUM: 'text-primary-600',
  LOW: 'text-gray-600',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}

function complianceColor(rate: number, target = 90) {
  if (rate >= target) return 'text-success-600';
  if (rate >= target - 5) return 'text-warning-600';
  return 'text-danger-600';
}

function complianceBg(rate: number, target = 90) {
  if (rate >= target) return 'bg-success-500';
  if (rate >= target - 5) return 'bg-warning-500';
  return 'bg-danger-500';
}

function TrendIndicator({ current, previous, higherIsBetter = true }: { current: number; previous: number; higherIsBetter?: boolean }) {
  const improved = higherIsBetter ? current > previous : current < previous;
  const diff = Math.abs(((current - previous) / (previous || 1)) * 100).toFixed(1);
  return (
    <span className={`flex items-center gap-1 text-xs ${improved ? 'text-success-600' : 'text-danger-600'}`}>
      {improved ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {diff}%
    </span>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function SLADashboardPage() {
  const [period, setPeriod] = useState<Period>('week');
  const [category, setCategory] = useState<SLACategoryTab>('maintenance');
  const [drillDownPriority, setDrillDownPriority] = useState<string | null>(null);

  // Fetch SLA metrics from API
  const { data: metricsData, isLoading: loadingMetrics } = useQuery({
    queryKey: ['sla', 'metrics', period],
    queryFn: () => slaService.getMetrics(period),
    retry: false,
  });

  // Fetch SLA health check
  const { data: healthData, isLoading: loadingHealth } = useQuery({
    queryKey: ['sla', 'health'],
    queryFn: () => slaService.getHealthCheck(),
    retry: false,
    refetchInterval: 60000, // refresh every minute
  });

  // Use API data or fallback
  const metrics = metricsData?.data ?? fallbackMetrics;
  const health = healthData?.data ?? fallbackHealth;
  const isLoading = loadingMetrics && loadingHealth;

  const categoryTabs = [
    { id: 'maintenance' as const, label: 'Maintenance', icon: Wrench },
    { id: 'payments' as const, label: 'Payments', icon: DollarSign },
    { id: 'communications' as const, label: 'Comms', icon: MessageSquare },
  ];

  return (
    <>
      <PageHeader
        title="SLA Dashboard"
        subtitle="Performance Metrics"
        action={
          <Link href="/reports/generate" className="btn-secondary text-sm flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            Report
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Period Selector */}
            <div className="flex gap-2">
              {(['day', 'week', 'month', 'quarter'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`btn text-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {categoryTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCategory(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors ${
                      category === tab.id
                        ? 'bg-white text-primary-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── Maintenance SLA ──────────────────────────────────────── */}
            {category === 'maintenance' && (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="Response Rate"
                    value={metrics.overall.responseComplianceRate}
                    target={95}
                    unit="%"
                    trend={<TrendIndicator current={metrics.overall.responseComplianceRate} previous={metrics.overall.responseComplianceRate - 3} />}
                  />
                  <MetricCard
                    label="Resolution Rate"
                    value={metrics.overall.resolutionComplianceRate}
                    target={90}
                    unit="%"
                    trend={<TrendIndicator current={metrics.overall.resolutionComplianceRate} previous={metrics.overall.resolutionComplianceRate - 2} />}
                  />
                  <MetricCard
                    label="Avg Response"
                    value={formatTime(metrics.overall.averageResponseTimeMinutes)}
                    targetLabel={`target: ${formatTime(120)}`}
                    isTime
                    trend={<TrendIndicator current={metrics.overall.averageResponseTimeMinutes} previous={metrics.overall.averageResponseTimeMinutes + 13} higherIsBetter={false} />}
                  />
                  <MetricCard
                    label="Avg Resolution"
                    value={formatTime(metrics.overall.averageResolutionTimeMinutes)}
                    targetLabel={`target: ${formatTime(1440)}`}
                    isTime
                    trend={<TrendIndicator current={metrics.overall.averageResolutionTimeMinutes} previous={metrics.overall.averageResolutionTimeMinutes + 120} higherIsBetter={false} />}
                  />
                </div>

                {/* Breach Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="card p-3 text-center">
                    <div className="text-2xl font-bold text-danger-600">{metrics.breaches.responseBreaches}</div>
                    <div className="text-xs text-gray-500">Response Breaches</div>
                  </div>
                  <div className="card p-3 text-center">
                    <div className="text-2xl font-bold text-danger-600">{metrics.breaches.resolutionBreaches}</div>
                    <div className="text-xs text-gray-500">Resolution Breaches</div>
                  </div>
                  <div className="card p-3 text-center">
                    <div className="text-2xl font-bold text-warning-600">{metrics.breaches.escalations}</div>
                    <div className="text-xs text-gray-500">Escalations</div>
                  </div>
                </div>

                {/* Trend Chart */}
                <section className="card p-4">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                    Compliance Trend
                  </h3>
                  <div className="flex items-end justify-between h-32 gap-2">
                    {metrics.trends.map((day, i) => {
                      const avg = Math.round(
                        (day.responseComplianceRate + day.resolutionComplianceRate) / 2
                      );
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center">
                          <div
                            className={`w-full rounded-t ${complianceBg(avg)}`}
                            style={{ height: `${avg}%` }}
                          />
                          <span className="text-xs text-gray-500 mt-1">
                            {day.date.length > 3 ? new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }) : day.date}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-success-500" /> &ge;90%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-warning-500" /> 85-89%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-danger-500" /> &lt;85%</span>
                  </div>
                </section>

                {/* Priority Breakdown (Drill-down) */}
                <section className="card p-4">
                  <h3 className="font-medium mb-4">Performance by Priority</h3>
                  <div className="space-y-3">
                    {Object.entries(metrics.byPriority).map(([priority, data]) => (
                      <div key={priority}>
                        <button
                          className="w-full text-left"
                          onClick={() => setDrillDownPriority(drillDownPriority === priority ? null : priority)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${priorityColors[priority] ?? 'text-gray-600'}`}>
                                {priority.charAt(0) + priority.slice(1).toLowerCase()}
                              </span>
                              <span className="badge-gray text-xs">{data.count} tickets</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-semibold ${complianceColor(data.responseComplianceRate, 90)}`}>
                                {data.responseComplianceRate}%
                              </span>
                              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${drillDownPriority === priority ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                          <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${complianceBg(data.responseComplianceRate)}`}
                              style={{ width: `${Math.min(data.responseComplianceRate, 100)}%` }}
                            />
                          </div>
                        </button>

                        {/* Drill-down details */}
                        {drillDownPriority === priority && (
                          <div className="mt-3 ml-4 pl-3 border-l-2 border-primary-200 space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500">Response Rate</div>
                                <div className={`font-semibold ${complianceColor(data.responseComplianceRate)}`}>
                                  {data.responseComplianceRate}%
                                </div>
                              </div>
                              <div className="p-2 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500">Resolution Rate</div>
                                <div className={`font-semibold ${complianceColor(data.resolutionComplianceRate)}`}>
                                  {data.resolutionComplianceRate}%
                                </div>
                              </div>
                              <div className="p-2 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500">Avg Response</div>
                                <div className="font-semibold">{formatTime(data.averageResponseTimeMinutes)}</div>
                              </div>
                              <div className="p-2 bg-gray-50 rounded-lg">
                                <div className="text-xs text-gray-500">Avg Resolution</div>
                                <div className="font-semibold">{formatTime(data.averageResolutionTimeMinutes)}</div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 flex items-center gap-2">
                              <Shield className="w-3 h-3" />
                              Target: {priorityTargets[priority]?.response ?? '—'} response / {priorityTargets[priority]?.resolution ?? '—'} resolution
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* At-Risk Items */}
                {health.atRisk.length > 0 && (
                  <section className="card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <Timer className="w-5 h-5 text-warning-500" />
                        At-Risk Items
                      </h3>
                      <span className="badge-warning">{health.atRisk.length}</span>
                    </div>
                    <div className="space-y-3">
                      {health.atRisk.map((item) => (
                        <Link key={item.workOrderId} href={`/work-orders/${item.workOrderId}`}>
                          <div className="p-3 bg-warning-50 rounded-lg border border-warning-100 hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="text-xs text-warning-600 font-medium">{item.workOrderNumber}</div>
                                <div className="font-medium text-sm">{item.title}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {item.priority} &bull; {item.type === 'response' ? 'Response' : 'Resolution'} SLA
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-warning-700">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-sm font-semibold">
                                    {slaService.formatTimeRemaining(item.remainingMinutes)}
                                  </span>
                                </div>
                                <div className="text-xs text-warning-500">remaining</div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* SLA Breaches */}
                {health.breached.length > 0 && (
                  <section className="card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-danger-500" />
                        Active SLA Breaches
                      </h3>
                      <span className="badge-danger">{health.breached.length}</span>
                    </div>
                    <div className="space-y-3">
                      {health.breached.map((item) => (
                        <Link key={item.workOrderId} href={`/work-orders/${item.workOrderId}`}>
                          <div className="p-3 bg-danger-50 rounded-lg border border-danger-100 hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="text-xs text-danger-600 font-medium">{item.workOrderNumber}</div>
                                <div className="font-medium text-sm">{item.title}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {item.priority} &bull; {item.type === 'response' ? 'Response' : 'Resolution'} Breach
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-danger-700">
                                  <XCircle className="w-3 h-3" />
                                  <span className="text-sm font-semibold">
                                    +{slaService.formatTimeRemaining(item.breachMinutes)}
                                  </span>
                                </div>
                                <div className="text-xs text-danger-500">overdue</div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* SLA Configuration Summary */}
                <section className="card p-4">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-400" />
                    SLA Configuration
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 font-medium text-gray-500">Priority</th>
                          <th className="text-right py-2 font-medium text-gray-500">Response</th>
                          <th className="text-right py-2 font-medium text-gray-500">Resolution</th>
                          <th className="text-right py-2 font-medium text-gray-500">Escalation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(priorityTargets).map(([prio, targets]) => (
                          <tr key={prio} className="border-b border-gray-50">
                            <td className={`py-2 font-medium ${priorityColors[prio]}`}>
                              {prio.charAt(0) + prio.slice(1).toLowerCase()}
                            </td>
                            <td className="py-2 text-right">{targets.response}</td>
                            <td className="py-2 text-right">{targets.resolution}</td>
                            <td className="py-2 text-right">{targets.escalation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* ── Payments SLA ─────────────────────────────────────────── */}
            {category === 'payments' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Invoice Delivery" value={paymentSlaMetrics.invoiceDeliveryRate} target={95} unit="%" />
                  <MetricCard label="Payment Processing" value={paymentSlaMetrics.paymentProcessingRate} target={90} unit="%" />
                  <MetricCard label="Refund Processing" value={paymentSlaMetrics.refundProcessingRate} target={90} unit="%" />
                  <MetricCard label="Overdue Follow-Up" value={paymentSlaMetrics.overdueFollowUpRate} target={95} unit="%" />
                </div>

                <section className="card p-4">
                  <h3 className="font-medium mb-4">Payment SLA Targets</h3>
                  <div className="space-y-3">
                    <SlaRow label="Invoice Delivery" target="Within 2 hours of generation" actual={`${paymentSlaMetrics.avgInvoiceDeliveryHours}h avg`} rate={paymentSlaMetrics.invoiceDeliveryRate} />
                    <SlaRow label="Payment Processing" target="Within 24 hours" actual={`${paymentSlaMetrics.avgPaymentProcessingHours}h avg`} rate={paymentSlaMetrics.paymentProcessingRate} />
                    <SlaRow label="Refund Processing" target="Within 5 business days" actual={`${paymentSlaMetrics.avgRefundProcessingDays}d avg`} rate={paymentSlaMetrics.refundProcessingRate} />
                    <SlaRow label="Overdue Follow-Up" target="Same day notification" actual="Same day" rate={paymentSlaMetrics.overdueFollowUpRate} />
                  </div>
                </section>

                <div className="card p-4 bg-primary-50 border-primary-200">
                  <div className="flex items-center gap-3">
                    <ArrowUpRight className="w-5 h-5 text-primary-600" />
                    <div>
                      <h4 className="font-medium text-primary-800">View Collections</h4>
                      <p className="text-sm text-primary-600">Track arrears and payment follow-ups</p>
                    </div>
                    <Link href="/collections" className="ml-auto btn-primary text-sm">Go</Link>
                  </div>
                </div>
              </>
            )}

            {/* ── Communications SLA ───────────────────────────────────── */}
            {category === 'communications' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="First Response" value={communicationSlaMetrics.firstResponseRate} target={95} unit="%" />
                  <MetricCard label="Escalation Response" value={communicationSlaMetrics.escalationResponseRate} target={90} unit="%" />
                  <MetricCard label="Resolution Notify" value={communicationSlaMetrics.resolutionNotificationRate} target={98} unit="%" />
                  <MetricCard label="Ticket Updates" value={communicationSlaMetrics.ticketUpdateRate} target={90} unit="%" />
                </div>

                <section className="card p-4">
                  <h3 className="font-medium mb-4">Communication SLA Targets</h3>
                  <div className="space-y-3">
                    <SlaRow label="First Response" target="Within 15 minutes" actual={`${communicationSlaMetrics.avgFirstResponseMinutes}m avg`} rate={communicationSlaMetrics.firstResponseRate} />
                    <SlaRow label="Escalation Response" target="Within 1 hour" actual={`${communicationSlaMetrics.avgEscalationResponseMinutes}m avg`} rate={communicationSlaMetrics.escalationResponseRate} />
                    <SlaRow label="Resolution Notification" target="Within 5 minutes" actual="Automated" rate={communicationSlaMetrics.resolutionNotificationRate} />
                    <SlaRow label="Daily Ticket Updates" target="At least 1 update/day" actual="Avg 2.3/day" rate={communicationSlaMetrics.ticketUpdateRate} />
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  target,
  unit,
  targetLabel,
  isTime,
  trend,
}: {
  label: string;
  value: number | string;
  target?: number;
  unit?: string;
  targetLabel?: string;
  isTime?: boolean;
  trend?: React.ReactNode;
}) {
  const numValue = typeof value === 'number' ? value : 0;
  const meetsTarget = target ? numValue >= target : true;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        {trend}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${
          isTime ? 'text-primary-600' : meetsTarget ? 'text-success-600' : 'text-warning-600'
        }`}>
          {value}{unit ?? ''}
        </span>
        {target && !isTime && (
          <span className="text-xs text-gray-400">/ {target}%</span>
        )}
        {targetLabel && (
          <span className="text-xs text-gray-400">{targetLabel}</span>
        )}
      </div>
      {target && !isTime && (
        <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${meetsTarget ? 'bg-success-500' : 'bg-warning-500'}`}
            style={{ width: `${Math.min(numValue, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function SlaRow({ label, target, actual, rate }: { label: string; target: string; actual: string; rate: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-400">Target: {target}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-semibold ${complianceColor(rate)}`}>{rate}%</div>
        <div className="text-xs text-gray-400">{actual}</div>
      </div>
    </div>
  );
}
