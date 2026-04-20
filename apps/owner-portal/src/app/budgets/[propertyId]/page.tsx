import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Wrench,
  Zap,
  FileText,
  Shield,
} from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button, EmptyState } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatCurrency } from '../../../lib/api';
import { usePropertyBudget } from '../../../lib/hooks';

export default function PropertyBudgetPage() {
  const t = useTranslations('propertyBudgetPage');
  const { propertyId } = useParams<{ propertyId: string }>();
  const { data: budget = null, isLoading, error, refetch } = usePropertyBudget(propertyId || '');

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load property budget'}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">{t('retry')}</Button>
        </AlertDescription>
      </Alert>
    );
  }

  // No fixture fallback — render an empty state when the property has no budget yet.
  if (!budget) {
    return (
      <EmptyState
        title={t('emptyTitle')}
        description={t('emptyDescription')}
      />
    );
  }

  const displayBudget = budget;

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'maintenance':
        return <Wrench className="h-5 w-5" />;
      case 'utilities':
        return <Zap className="h-5 w-5" />;
      case 'insurance':
        return <Shield className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const utilizationPercent = displayBudget.totalBudget
    ? (displayBudget.totalSpent / displayBudget.totalBudget) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/budgets" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{displayBudget.propertyName}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <Link
          to="/budgets/forecasts"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          {t('viewForecasts')}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('totalBudget')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(displayBudget.totalBudget)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('spent')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(displayBudget.totalSpent)}
          </p>
          <p className="text-sm text-gray-500">{utilizationPercent.toFixed(1)}% {t('utilized')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('remaining')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(displayBudget.totalBudget - displayBudget.totalSpent)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('budgetByCategory')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('thCategory')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('thBudgeted')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('thSpent')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('thVariance')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayBudget.categories.map((cat) => {
                const pct = cat.budgeted ? (cat.spent / cat.budgeted) * 100 : 0;
                return (
                  <tr key={cat.category} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                          {getCategoryIcon(cat.category)}
                        </div>
                        <span className="font-medium text-gray-900">{cat.category}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(cat.budgeted)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(cat.spent)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          cat.variance <= 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {formatCurrency(cat.variance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          pct <= 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
