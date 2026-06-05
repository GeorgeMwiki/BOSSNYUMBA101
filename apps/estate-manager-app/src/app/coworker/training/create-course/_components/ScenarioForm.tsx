'use client';

/**
 * ScenarioForm — step 2 of the coworker create-course flow.
 *
 * Collects the learner's own description of the estate-management situation
 * plus a difficulty choice. Single-language per render (never mixes EN/SW).
 */

import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Language = 'en' | 'sw';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';

const MIN_LENGTH = 10;
const MAX_LENGTH = 4_000;
const DIFFICULTY_ORDER: ReadonlyArray<Difficulty> = [
  'beginner',
  'intermediate',
  'advanced',
];

export interface ScenarioResult {
  readonly scenarioDescription: string;
  readonly difficulty: Difficulty;
}

interface ScenarioFormProps {
  readonly language: Language;
  readonly domainLabel: string;
  readonly onBack: () => void;
  readonly onSubmit: (result: ScenarioResult) => void;
}

export function ScenarioForm({
  language,
  domainLabel,
  onBack,
  onSubmit,
}: ScenarioFormProps): JSX.Element {
  const t = useTranslations('createCourse');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [touched, setTouched] = useState(false);

  const trimmed = description.trim();
  const isValid = trimmed.length >= MIN_LENGTH;

  const difficultyLabel: Record<Difficulty, string> = {
    beginner: t('difficultyBeginner'),
    intermediate: t('difficultyIntermediate'),
    advanced: t('difficultyAdvanced'),
  };

  return (
    <section
      aria-labelledby="scenario-step-heading"
      className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5"
    >
      <div>
        <h2 id="scenario-step-heading" className="text-lg font-semibold text-gray-900">
          {t('scenarioHeading')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t('scenarioSubheading')}</p>
        <p className="text-xs font-medium text-sky-700 mt-2">{domainLabel}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="scenario-description" className="text-sm font-medium text-gray-700">
          {t('scenarioLabel')}
        </label>
        <textarea
          id="scenario-description"
          value={description}
          maxLength={MAX_LENGTH}
          rows={6}
          placeholder={t('scenarioPlaceholder')}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && !isValid}
          className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <div className="flex items-center justify-between">
          {touched && !isValid ? (
            <p role="alert" className="text-xs text-danger-600">
              {t('scenarioTooShort')}
            </p>
          ) : (
            <span />
          )}
          <p className="text-xs text-gray-400">
            {trimmed.length}/{MAX_LENGTH}
          </p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">
          {t('difficultyLabel')}
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTY_ORDER.map((level) => {
            const active = difficulty === level;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={active}
                onClick={() => setDifficulty(level)}
                className={`rounded-xl border-2 px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  active
                    ? 'border-sky-500 bg-sky-50 font-semibold text-sky-800'
                    : 'border-gray-200 text-gray-700 hover:border-sky-300'
                }`}
              >
                {difficultyLabel[level]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </button>
        <button
          type="button"
          disabled={!isValid}
          onClick={() => {
            setTouched(true);
            if (isValid) onSubmit({ scenarioDescription: trimmed, difficulty });
          }}
          className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {t('continue')}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
