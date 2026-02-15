'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Star,
  Phone,
  MessageSquare,
  ChevronRight,
  Clock,
  DollarSign,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Flag,
  BarChart2,
  Wrench,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  Award,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface VendorScorecard {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  specializations: string[];
  status: 'active' | 'suspended' | 'pending_review';
  overallScore: number;
  scoreTrend: 'up' | 'down' | 'stable';
  metrics: {
    responseTime: { value: string; score: number; benchmark: string };
    completionRate: { value: number; score: number; benchmark: number };
    qualityRating: { value: number; score: number; benchmark: number };
    costEfficiency: { value: number; score: number; benchmark: number };
    customerSatisfaction: { value: number; score: number; benchmark: number };
  };
  recentJobs: Array<{
    id: string;
    title: string;
    unit: string;
    completedAt: string;
    rating: number;
    cost: number;
    duration: string;
  }>;
  monthlyStats: Array<{
    month: string;
    jobs: number;
    avgRating: number;
    revenue: number;
  }>;
  badges: string[];
  flags: Array<{ reason: string; date: string; resolvedAt?: string }>;
  certifications: string[];
  insuranceExpiry: string;
  contractStart: string;
}

// Mock data
const MOCK_SCORECARD: VendorScorecard = {
  id: 'v1',
  name: 'Peter Ochieng',
  company: 'Quick Fix Plumbing',
  phone: '+254 723 456 789',
  email: 'peter@quickfix.co.ke',
  specializations: ['Plumbing', 'Gas Appliances'],
  status: 'active',
  overallScore: 95,
  scoreTrend: 'up',
  metrics: {
    responseTime: { value: '1.5 hours', score: 98, benchmark: '4 hours' },
    completionRate: { value: 93, score: 93, benchmark: 85 },
    qualityRating: { value: 4.8, score: 96, benchmark: 4.0 },
    costEfficiency: { value: 92, score: 92, benchmark: 80 },
    customerSatisfaction: { value: 4.9, score: 98, benchmark: 4.0 },
  },
  recentJobs: [
    { id: 'j1', title: 'Leaking faucet repair', unit: 'A-101', completedAt: '2024-02-12', rating: 5, cost: 3500, duration: '1h 30m' },
    { id: 'j2', title: 'Toilet replacement', unit: 'B-202', completedAt: '2024-02-10', rating: 5, cost: 15000, duration: '3h' },
    { id: 'j3', title: 'Pipe burst emergency', unit: 'C-301', completedAt: '2024-02-08', rating: 4, cost: 8500, duration: '2h 15m' },
    { id: 'j4', title: 'Water heater install', unit: 'A-104', completedAt: '2024-02-05', rating: 5, cost: 25000, duration: '4h' },
  ],
  monthlyStats: [
    { month: 'Feb 2024', jobs: 12, avgRating: 4.8, revenue: 85000 },
    { month: 'Jan 2024', jobs: 15, avgRating: 4.7, revenue: 102000 },
    { month: 'Dec 2023', jobs: 18, avgRating: 4.9, revenue: 125000 },
  ],
  badges: ['Top Rated', 'Fast Response', 'Certified'],
  flags: [
    { reason: 'Late completion on WO-1234', date: '2023-11-15', resolvedAt: '2023-11-20' },
  ],
  certifications: ['Licensed Plumber (Kenya)', 'Gas Safe Registered'],
  insuranceExpiry: '2024-12-31',
  contractStart: '2022-06-01',
};

export default function VendorScorecardPage() {
  const params = useParams();
  const [scorecard, setScorecard] = useState<VendorScorecard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'history'>('overview');

  useEffect(() => {
    setTimeout(() => {
      setScorecard(MOCK_SCORECARD);
      setIsLoading(false);
    }, 500);
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-warning-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Vendor not found</h2>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success-600';
    if (score >= 70) return 'text-warning-600';
    return 'text-danger-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-success-500';
    if (score >= 70) return 'bg-warning-500';
    return 'bg-danger-500';
  };

  return (
    <>
      <PageHeader title="Vendor Scorecard" showBack />

      <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto pb-24">
        {/* Vendor Header */}
        <div className="card p-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-semibold text-primary-700">
                {scorecard.name.split(' ').map((n) => n[0]).join('')}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">{scorecard.name}</h2>
              <div className="text-sm text-gray-500">{scorecard.company}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {scorecard.specializations.map((spec) => (
                  <span key={spec} className="badge-gray text-xs">{spec}</span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${getScoreColor(scorecard.overallScore)}`}>
                {scorecard.overallScore}
              </div>
              <div className="flex items-center justify-end gap-1 text-xs">
                {scorecard.scoreTrend === 'up' && (
                  <>
                    <TrendingUp className="w-3 h-3 text-success-500" />
                    <span className="text-success-600">Improving</span>
                  </>
                )}
                {scorecard.scoreTrend === 'down' && (
                  <>
                    <TrendingDown className="w-3 h-3 text-danger-500" />
                    <span className="text-danger-600">Declining</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <a href={`tel:${scorecard.phone}`} className="btn-secondary flex-1">
              <Phone className="w-4 h-4 mr-1" />
              Call
            </a>
            <Link href={`/messaging/new?vendorId=${scorecard.id}`} className="btn-secondary flex-1">
              <MessageSquare className="w-4 h-4 mr-1" />
              Message
            </Link>
          </div>
        </div>

        {/* Badges */}
        {scorecard.badges.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {scorecard.badges.map((badge) => (
              <span key={badge} className="badge-primary flex items-center gap-1">
                <Award className="w-3 h-3" />
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {(['overview', 'jobs', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Performance Metrics */}
            <div className="card p-4 space-y-4">
              <h3 className="font-semibold">Performance Metrics</h3>
              
              {Object.entries(scorecard.metrics).map(([key, metric]) => {
                const labels: Record<string, string> = {
                  responseTime: 'Response Time',
                  completionRate: 'Completion Rate',
                  qualityRating: 'Quality Rating',
                  costEfficiency: 'Cost Efficiency',
                  customerSatisfaction: 'Customer Satisfaction',
                };
                const isRating = key.includes('Rating') || key.includes('Satisfaction');
                const displayValue = isRating
                  ? `${metric.value}/5`
                  : typeof metric.value === 'number'
                  ? `${metric.value}%`
                  : metric.value;
                const benchmarkDisplay = isRating
                  ? `${metric.benchmark}/5`
                  : typeof metric.benchmark === 'number'
                  ? `${metric.benchmark}%`
                  : metric.benchmark;

                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{labels[key]}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{displayValue}</span>
                        <span className="text-xs text-gray-400">(Benchmark: {benchmarkDisplay})</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getScoreBg(metric.score)}`}
                        style={{ width: `${metric.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Monthly Summary */}
            <div className="card p-4">
              <h3 className="font-semibold mb-4">Monthly Summary</h3>
              <div className="space-y-3">
                {scorecard.monthlyStats.map((stat) => (
                  <div key={stat.month} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">{stat.month}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{stat.jobs} jobs</span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        {stat.avgRating}
                      </span>
                      <span className="text-success-600">KES {stat.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Certifications & Insurance */}
            <div className="card p-4 space-y-4">
              <h3 className="font-semibold">Credentials</h3>
              <div>
                <div className="text-sm text-gray-500 mb-2">Certifications</div>
                <div className="space-y-1">
                  {scorecard.certifications.map((cert) => (
                    <div key={cert} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-success-500" />
                      {cert}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Insurance Expiry</div>
                  <div className="text-sm font-medium">
                    {new Date(scorecard.insuranceExpiry).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Contract Start</div>
                  <div className="text-sm font-medium">
                    {new Date(scorecard.contractStart).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Flags */}
            {scorecard.flags.length > 0 && (
              <div className="card p-4">
                <h3 className="font-semibold mb-3">Flag History</h3>
                <div className="space-y-2">
                  {scorecard.flags.map((flag, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        flag.resolvedAt ? 'bg-gray-50' : 'bg-warning-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Flag className={`w-4 h-4 ${flag.resolvedAt ? 'text-gray-400' : 'text-warning-500'}`} />
                          <span className="text-sm">{flag.reason}</span>
                        </div>
                        {flag.resolvedAt && (
                          <span className="badge-success text-xs">Resolved</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 ml-6">
                        Flagged: {new Date(flag.date).toLocaleDateString()}
                        {flag.resolvedAt && ` • Resolved: ${new Date(flag.resolvedAt).toLocaleDateString()}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-3">
            {scorecard.recentJobs.map((job) => (
              <Link key={job.id} href={`/work-orders/${job.id}`} className="card p-4 block">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium">{job.title}</div>
                    <div className="text-sm text-gray-500">Unit {job.unit}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="font-medium">{job.rating}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(job.completedAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {job.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    KES {job.cost.toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="card p-4">
            <h3 className="font-semibold mb-4">Performance History</h3>
            <div className="space-y-4">
              <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                <BarChart2 className="w-8 h-8" />
                <span className="ml-2">Performance chart</span>
              </div>
              <p className="text-sm text-gray-500 text-center">
                Detailed performance analytics would display here
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
