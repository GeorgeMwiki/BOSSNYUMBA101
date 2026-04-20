/**
 * Maintenance taxonomy admin — Wave 15 UI gap closure.
 *
 *   GET /maintenance-taxonomy/categories — merged categories
 *   GET /maintenance-taxonomy/problems   — merged problem list
 *   POST /maintenance-taxonomy/categories, /problems — tenant override
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Wrench, Loader2, Plus } from 'lucide-react';
import { api } from '../lib/api';

interface Category {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly active?: boolean;
}

interface Problem {
  readonly id: string;
  readonly categoryId: string;
  readonly code: string;
  readonly name: string;
  readonly defaultSeverity?: string;
  readonly defaultSlaHours?: number;
  readonly evidenceRequired?: boolean;
}

export default function MaintenanceTaxonomy(): JSX.Element {
  const t = useTranslations('maintenanceTaxonomy');
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [problems, setProblems] = useState<readonly Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCat, setNewCat] = useState({ code: '', name: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [cats, probs] = await Promise.all([
      api.get<readonly Category[]>('/maintenance-taxonomy/categories'),
      api.get<readonly Problem[]>('/maintenance-taxonomy/problems'),
    ]);
    if (cats.success && cats.data) setCategories(cats.data);
    else setError(cats.error ?? t('errors.loadFailed'));
    if (probs.success && probs.data) setProblems(probs.data);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCategory(): Promise<void> {
    if (!newCat.code || !newCat.name) return;
    const res = await api.post('/maintenance-taxonomy/categories', newCat);
    if (res.success) {
      setNewCat({ code: '', name: '' });
      setCreatingCat(false);
      void load();
    } else {
      setError(res.error ?? t('errors.createFailed'));
    }
  }

  const filteredProblems = activeCat
    ? problems.filter((p) => p.categoryId === activeCat)
    : problems;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Wrench className="h-6 w-6 text-orange-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">
            {t('subtitle')}
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <section className="md:col-span-1 bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{t('categories')}</h3>
              <button
                type="button"
                onClick={() => setCreatingCat(!creatingCat)}
                className="text-xs text-orange-600 inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> new
              </button>
            </div>
            {creatingCat && (
              <div className="space-y-2 bg-orange-50 p-2 rounded">
                <input
                  type="text"
                  placeholder={t('placeholders.code')}
                  value={newCat.code}
                  onChange={(e) => setNewCat({ ...newCat, code: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  type="text"
                  placeholder={t('placeholders.name')}
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void createCategory()}
                  className="text-xs bg-orange-600 text-white px-3 py-1 rounded"
                >
                  {t('save')}
                </button>
              </div>
            )}
            <ul className="space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => setActiveCat(null)}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${
                    activeCat === null ? 'bg-orange-50 text-orange-700' : 'hover:bg-gray-50'
                  }`}
                >
                  {t('all')}
                </button>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveCat(c.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      activeCat === c.id
                        ? 'bg-orange-50 text-orange-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {c.name}{' '}
                    <span className="text-xs text-gray-400">({c.code})</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              {t('problemsTitle', { count: filteredProblems.length })}
            </h3>
            {filteredProblems.length === 0 ? (
              <p className="text-sm text-gray-500">{t('noProblems')}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredProblems.map((p) => (
                  <li key={p.id} className="py-2">
                    <p className="font-medium text-gray-900 text-sm">
                      {p.name}{' '}
                      <code className="text-xs text-gray-500 bg-gray-50 px-1 rounded">
                        {p.code}
                      </code>
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.defaultSeverity ?? '—'} · SLA {p.defaultSlaHours ?? '—'}h
                      {p.evidenceRequired ? ' · evidence required' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
