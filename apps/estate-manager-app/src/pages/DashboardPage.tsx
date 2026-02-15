'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Bell,
  Calendar,
  ChevronRight,
  AlertCircle,
  Wrench,
  DollarSign,
  Users,
  Home,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

// Types
interface SLAMetric {
  id: string;
  name: string;
  target: number;
  actual: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'healthy' | 'warning' | 'critical';
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: Date;
  actionLabel?: string;
  actionHref?: string;
}

interface DailyTask {
  id: string;
  title: string;
  category: 'inspection' | 'payment' | 'maintenance' | 'meeting';
  time?: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
}

// Mock Data
const mockSLAMetrics: SLAMetric[] = [
  {
    id: '1',
    name: 'Response Time',
    target: 24,
    actual: 18,
    unit: 'hrs',
    trend: 'down',
    status: 'healthy',
  },
  {
    id: '2',
    name: 'Resolution Rate',
    target: 95,
    actual: 92,
    unit: '%',
    trend: 'up',
    status: 'warning',
  },
  {
    id: '3',
    name: 'Tenant Satisfaction',
    target: 4.5,
    actual: 4.7,
    unit: '/5',
    trend: 'up',
    status: 'healthy',
  },
  {
    id: '4',
    name: 'Occupancy Rate',
    target: 95,
    actual: 88,
    unit: '%',
    trend: 'down',
    status: 'critical',
  },
];

const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    title: 'SLA Breach - Unit 4B',
    description: 'Water leak repair exceeded 48hr SLA by 6 hours',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    actionLabel: 'View Details',
    actionHref: '/work-orders/wo-123',
  },
  {
    id: '2',
    type: 'critical',
    title: 'Rent Arrears Alert',
    description: '3 tenants over 30 days past due totaling KES 145,000',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    actionLabel: 'View Collections',
    actionHref: '/collections',
  },
  {
    id: '3',
    type: 'warning',
    title: 'Inspection Due Tomorrow',
    description: 'Block A quarterly inspection scheduled',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    actionLabel: 'Prepare Checklist',
    actionHref: '/inspections/new',
  },
  {
    id: '4',
    type: 'info',
    title: 'Vendor Invoice Pending',
    description: 'Apex Plumbing submitted invoice for approval',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    actionLabel: 'Review',
    actionHref: '/vendors',
  },
];

const mockDailyTasks: DailyTask[] = [
  {
    id: '1',
    title: 'Morning property walkthrough',
    category: 'inspection',
    time: '08:00',
    completed: true,
    priority: 'high',
  },
  {
    id: '2',
    title: 'Review pending work orders',
    category: 'maintenance',
    time: '09:30',
    completed: true,
    priority: 'high',
  },
  {
    id: '3',
    title: 'Collect rent - Unit 2A',
    category: 'payment',
    time: '11:00',
    completed: false,
    priority: 'high',
  },
  {
    id: '4',
    title: 'Meet plumber - Unit 4B leak',
    category: 'maintenance',
    time: '14:00',
    completed: false,
    priority: 'medium',
  },
  {
    id: '5',
    title: 'Move-in inspection Unit 6C',
    category: 'inspection',
    time: '16:00',
    completed: false,
    priority: 'medium',
  },
];

const quickStats = [
  { label: 'Open Work Orders', value: 12, icon: Wrench, color: 'text-blue-600 bg-blue-50' },
  { label: 'Pending Payments', value: 8, icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Active Tenants', value: 45, icon: Users, color: 'text-purple-600 bg-purple-50' },
  { label: 'Vacant Units', value: 4, icon: Home, color: 'text-amber-600 bg-amber-50' },
];

export default function DashboardPage() {
  const [tasks, setTasks] = useState<DailyTask[]>(mockDailyTasks);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => [...prev, alertId]);
  };

  const visibleAlerts = mockAlerts.filter((a) => !dismissedAlerts.includes(a.id));
  const completedTasks = tasks.filter((t) => t.completed).length;

  const formatTimeAgo = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-amber-200 bg-amber-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      default:
        return <Bell className="w-5 h-5 text-blue-600" />;
    }
  };

  const getCategoryIcon = (category: DailyTask['category']) => {
    switch (category) {
      case 'inspection':
        return <CheckCircle className="w-4 h-4" />;
      case 'payment':
        return <DollarSign className="w-4 h-4" />;
      case 'maintenance':
        return <Wrench className="w-4 h-4" />;
      case 'meeting':
        return <Users className="w-4 h-4" />;
    }
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        action={
          <button className="btn-secondary text-sm">
            <Bell className="w-4 h-4" />
          </button>
        }
      />

      <div className="px-4 py-4 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          {quickStats.map((stat) => (
            <div key={stat.label} className="card p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SLA Metrics */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">SLA Performance</h2>
            <button className="text-sm text-primary-600 font-medium">View All</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {mockSLAMetrics.map((metric) => (
              <SLAMetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </section>

        {/* Alerts */}
        {visibleAlerts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Alerts
                <span className="badge-error text-xs">{visibleAlerts.length}</span>
              </h2>
            </div>
            <div className="space-y-3">
              {visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`card p-4 border-l-4 ${getAlertStyles(alert.type)}`}
                >
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-gray-900">{alert.title}</h3>
                        <button
                          onClick={() => dismissAlert(alert.id)}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(alert.timestamp)}
                        </span>
                        {alert.actionLabel && (
                          <a
                            href={alert.actionHref}
                            className="text-sm font-medium text-primary-600 flex items-center gap-1"
                          >
                            {alert.actionLabel}
                            <ChevronRight className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Daily Briefing */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-500" />
              Today's Tasks
            </h2>
            <span className="text-sm text-gray-500">
              {completedTasks}/{tasks.length} done
            </span>
          </div>
          <div className="card divide-y divide-gray-100">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 flex items-center gap-3 ${
                  task.completed ? 'opacity-60' : ''
                }`}
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    task.completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-gray-300 hover:border-emerald-400'
                  }`}
                >
                  {task.completed && <CheckCircle className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-medium ${
                      task.completed ? 'line-through text-gray-400' : 'text-gray-900'
                    }`}
                  >
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`flex items-center gap-1 text-xs ${
                        task.priority === 'high'
                          ? 'text-red-600'
                          : task.priority === 'medium'
                          ? 'text-amber-600'
                          : 'text-gray-500'
                      }`}
                    >
                      {getCategoryIcon(task.category)}
                      {task.category}
                    </span>
                    {task.time && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {task.time}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

// SLA Metric Card Component
function SLAMetricCard({ metric }: { metric: SLAMetric }) {
  const percentage = (metric.actual / metric.target) * 100;
  const isAboveTarget = metric.actual >= metric.target;

  const statusColors = {
    healthy: 'text-emerald-600',
    warning: 'text-amber-600',
    critical: 'text-red-600',
  };

  const progressColors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-gray-600">{metric.name}</span>
        <div className="flex items-center gap-1">
          <TrendingUp
            className={`w-4 h-4 ${
              metric.trend === 'up'
                ? 'text-emerald-500'
                : metric.trend === 'down'
                ? 'text-red-500 rotate-180'
                : 'text-gray-400'
            }`}
          />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${statusColors[metric.status]}`}>
          {metric.actual}
        </span>
        <span className="text-sm text-gray-400">
          / {metric.target}
          {metric.unit}
        </span>
      </div>
      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progressColors[metric.status]}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-gray-500">
        {isAboveTarget ? 'Above target' : 'Below target'}
      </div>
    </div>
  );
}
