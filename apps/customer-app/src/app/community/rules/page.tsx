'use client';

import { AlertTriangle, FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@bossnyumba/api-client';

interface CommunityRule {
  title: string;
  content: string;
}

function RulesSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card p-4 space-y-2">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-full bg-gray-200 rounded" />
          <div className="h-3 w-3/4 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function PropertyRulesPage() {
  const { data: rules, isLoading, isError, refetch } = useQuery<CommunityRule[]>('/community/rules');

  return (
    <>
      <PageHeader title="Property Rules" showBack />

      {isLoading ? (
        <RulesSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Failed to load rules</h2>
          <p className="text-gray-500 text-sm mb-6">Could not load property rules.</p>
          <button onClick={() => refetch()} className="btn-primary px-6 py-2">Retry</button>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary-50 rounded-lg">
              <FileText className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold">Building Guidelines</h2>
              <p className="text-sm text-gray-500">Please follow these rules for a pleasant community</p>
            </div>
          </div>

          {rules && rules.length > 0 ? (
            <div className="space-y-4">
              {rules.map((rule, index) => (
                <div key={index} className="card p-4">
                  <h3 className="font-medium text-primary-600 mb-2">{rule.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{rule.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">No rules available</h3>
              <p className="text-sm text-gray-500 mt-1">Property rules will be posted here</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
