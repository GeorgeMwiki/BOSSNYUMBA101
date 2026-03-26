'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Search, ChevronRight, Plus, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { conditionSurveysService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  overdue: 'bg-red-100 text-red-700',
};

export default function ConditionSurveysPage() {
  const [yearFilter, setYearFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['condition-surveys', { year: yearFilter || undefined }],
    queryFn: () => conditionSurveysService.list({ year: yearFilter || undefined }),
    retry: false,
  });

  const surveys = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Condition Surveys"
        subtitle="Annual asset condition assessments"
        action={
          <Link href="/assets/surveys/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            New Survey
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Year Filter */}
        <div className="flex gap-3">
          <select className="input w-full sm:w-auto" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">All Financial Years</option>
            <option value="2025/2026">2025/2026</option>
            <option value="2024/2025">2024/2025</option>
            <option value="2023/2024">2023/2024</option>
          </select>
        </div>

        {/* Surveys List */}
        {isLoading ? (
          <div className="card p-8 text-center text-gray-500">Loading...</div>
        ) : surveys.length === 0 ? (
          <div className="card p-8 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No condition surveys found</p>
            <p className="text-sm text-gray-400 mt-1">Create a survey campaign to assess asset conditions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {surveys.map((survey: {
              id: string;
              surveyCode: string;
              title: string;
              financialYear?: string;
              status?: string;
              totalAssets?: number;
              completedAssets?: number;
              plannedStartDate?: string;
              plannedEndDate?: string;
            }) => {
              const progress = survey.totalAssets ? Math.round(((survey.completedAssets ?? 0) / survey.totalAssets) * 100) : 0;
              return (
                <Link key={survey.id} href={`/assets/surveys/${survey.id}`}>
                  <div className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <div className="font-medium">{survey.title}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {survey.financialYear ?? '—'} • {survey.surveyCode}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[survey.status ?? 'planned']}`}>
                          {(survey.status ?? 'planned').replace(/_/g, ' ')}
                        </span>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="bg-indigo-500 rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{survey.completedAssets ?? 0}/{survey.totalAssets ?? 0}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
