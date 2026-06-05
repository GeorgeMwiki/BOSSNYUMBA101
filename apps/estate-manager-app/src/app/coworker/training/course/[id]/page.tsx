'use client';

/**
 * /coworker/training/course/[id] — generated course view + generation poller.
 *
 * The create-course flow redirects here right after kickoff. Generation runs in
 * the background, so this page polls GET /api/v1/courses/:id until the lessons
 * land (or a generationError surfaces). Three states:
 *   - generating : status 'draft', lessonCount 0, no generationError -> spinner
 *   - failed     : status 'draft' WITH generationError -> retry affordance
 *   - ready      : status 'in_progress'/'completed' with lessons -> render
 *
 * Single-language per render. Lessons render in a simple stepper with the first
 * lesson expanded; the quiz is shown read-only here (taking the quiz is the
 * delivery surface's concern).
 */

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, CheckCircle2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROUTES } from '@/lib/routes';
import { coursesService } from '@bossnyumba/api-client';
import type {
  CourseWithLessons,
  CourseLessonRow,
} from '@bossnyumba/api-client/courses-types';

function isReady(course: CourseWithLessons | undefined): boolean {
  return !!course && course.lessons.length > 0 && !course.generationError;
}

function isFailed(course: CourseWithLessons | undefined): boolean {
  return !!course && !!course.generationError;
}

export default function CourseViewPage(): JSX.Element {
  const t = useTranslations('courseView');
  const params = useParams<{ id: string }>();
  const courseId = typeof params.id === 'string' ? params.id : '';

  const query = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const res = await coursesService.get(courseId);
      return res.data;
    },
    enabled: courseId.length > 0,
    // Poll while still generating; stop once ready or failed.
    refetchInterval: (q) => {
      const data = q.state.data as CourseWithLessons | undefined;
      if (isReady(data) || isFailed(data)) return false;
      return 2_500;
    },
    retry: 1,
  });

  const course = query.data;

  return (
    <>
      <PageHeader title={t('title')} showBack />
      <div className="mx-auto max-w-3xl px-4 py-4">
        {query.isLoading && <Generating label={t('loading')} />}

        {!query.isLoading && query.isError && (
          <ErrorPanel message={(query.error as Error)?.message ?? t('loadError')} />
        )}

        {!query.isLoading && course && isFailed(course) && (
          <FailedPanel message={course.generationError ?? t('generationFailed')} />
        )}

        {!query.isLoading && course && !isFailed(course) && !isReady(course) && (
          <Generating label={t('generating')} />
        )}

        {!query.isLoading && course && isReady(course) && (
          <ReadyCourse course={course} />
        )}
      </div>
    </>
  );
}

function Generating({ label }: { label: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white py-12 text-center">
      <div className="relative h-10 w-10">
        <Sparkles className="h-10 w-10 text-sky-300" />
        <Loader2 className="absolute inset-0 h-10 w-10 animate-spin text-sky-500" />
      </div>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }): JSX.Element {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function FailedPanel({ message }: { message: string }): JSX.Element {
  const t = useTranslations('courseView');
  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
      <div>
        <h2 className="text-base font-semibold text-gray-900">{t('generationFailedTitle')}</h2>
        <p className="mt-1 text-sm text-gray-700">{message}</p>
      </div>
      <Link
        href={ROUTES.coworker.createCourse}
        className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
      >
        <Sparkles className="h-4 w-4" />
        {t('tryAgain')}
      </Link>
    </div>
  );
}

function ReadyCourse({ course }: { course: CourseWithLessons }): JSX.Element {
  const t = useTranslations('courseView');
  const totalMinutes = useMemo(
    () =>
      course.lessons.reduce(
        (acc, l) => acc + (l.content?.estimatedMinutes ?? 0),
        0,
      ),
    [course.lessons],
  );

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-800">
            {t(`difficulty_${course.difficulty}`)}
          </span>
          <span className="text-gray-500">
            {t('lessonCount', { count: course.lessonCount })}
          </span>
          {totalMinutes > 0 && (
            <span className="text-gray-500">{t('minutes', { count: totalMinutes })}</span>
          )}
          <ProvenanceBadge via={course.generatedVia} />
        </div>
        <h1 className="mt-2 text-xl font-bold text-gray-900">{course.title}</h1>
        <p className="mt-1 text-sm text-gray-600">{course.summary}</p>
      </header>

      <ol className="space-y-3" role="list">
        {course.lessons.map((lesson, index) => (
          <LessonCard key={lesson.id} lesson={lesson} defaultOpen={index === 0} />
        ))}
      </ol>
    </div>
  );
}

function ProvenanceBadge({ via }: { via: CourseWithLessons['generatedVia'] }): JSX.Element {
  const t = useTranslations('courseView');
  if (via === 'llm') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-violet-800">
        <Sparkles className="h-3 w-3" />
        {t('viaLlm')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
      {t('viaDeterministic')}
    </span>
  );
}

function LessonCard({
  lesson,
  defaultOpen,
}: {
  lesson: CourseLessonRow;
  defaultOpen: boolean;
}): JSX.Element {
  const t = useTranslations('courseView');
  const [open, setOpen] = useState(defaultOpen);
  const content = lesson.content;

  return (
    <li className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
          {lesson.lessonNumber}
        </span>
        <span className="flex-1 font-medium text-gray-900">{lesson.lessonTitle}</span>
        {lesson.status === 'completed' && (
          <CheckCircle2 className="h-4 w-4 text-green-600" aria-label={t('completed')} />
        )}
        {open ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {open && content && (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          {content.objectives?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('objectives')}
              </h4>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-700">
                {content.objectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}

          {content.content && (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {content.content}
            </div>
          )}

          {content.keyTakeaways?.length > 0 && (
            <div className="rounded-xl bg-sky-50 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                {t('keyTakeaways')}
              </h4>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-sky-900">
                {content.keyTakeaways.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
          )}

          {content.quiz?.length > 0 && (
            <p className="text-xs text-gray-500">
              {t('quizCount', { count: content.quiz.length })}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
