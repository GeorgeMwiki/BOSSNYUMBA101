/**
 * Courses API Service — client wrapper for /api/v1/courses endpoints.
 *
 * Backs the coworker create-course flow. All endpoints require a Supabase
 * Bearer token (the api-client's onTokenRefresh supplies it). The signed-in
 * employee is derived server-side; the client never sends a user id.
 *
 * Type shapes are declared HERE (explicit interfaces, not z.infer) so the FE
 * can import them via the `@bossnyumba/api-client/courses-types` tsconfig path
 * alias WITHOUT tripping the NodeNext `export *` barrel TS2709 type-vs-namespace
 * defect. The `coursesService` VALUE is imported from the package root as usual.
 *
 * @module services/courses
 */

import { getApiClient, ApiResponse } from '../client';

export type CourseLanguage = 'en' | 'sw';
export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type CourseStatus = 'draft' | 'in_progress' | 'completed';
export type CourseLessonStatus = 'not_started' | 'in_progress' | 'completed';
export type CourseGenerationSource = 'llm' | 'deterministic';

export interface CourseQuizQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface CourseLessonContent {
  title: string;
  objectives: string[];
  content: string;
  keyTakeaways: string[];
  quiz: CourseQuizQuestion[];
  estimatedMinutes: number;
}

export interface CourseLessonRow {
  id: string;
  lessonNumber: number;
  lessonTitle: string;
  status: CourseLessonStatus;
  quizScore: number | null;
  content: CourseLessonContent;
}

export interface CourseSummary {
  id: string;
  domain: string;
  scenarioDescription: string;
  status: CourseStatus;
  difficulty: CourseDifficulty;
  language: CourseLanguage;
  title: string;
  summary: string;
  lessonCount: number;
  generatedVia: CourseGenerationSource;
  createdAt: string;
  updatedAt: string;
  /** Present only when a background generation failed (status stays 'draft'). */
  generationError?: string;
}

export interface CourseWithLessons extends CourseSummary {
  lessons: CourseLessonRow[];
}

export interface CourseDocumentInput {
  documentId: string;
  documentName?: string;
  documentType?: string;
  summary?: string;
  extractedData?: Record<string, unknown>;
}

export interface GenerateCourseRequest {
  domain: string;
  scenarioDescription: string;
  language: CourseLanguage;
  difficulty: CourseDifficulty;
  documents?: CourseDocumentInput[];
}

export interface GenerateCourseAccepted {
  id: string;
  courseId: string;
  status: 'generating';
  domainLabel: string;
}

export const coursesService = {
  /**
   * Kick off generation. Returns 202 with a placeholder course id immediately;
   * poll `get(id)` until lessons appear (or a generationError is surfaced).
   */
  async generate(
    body: GenerateCourseRequest,
  ): Promise<ApiResponse<GenerateCourseAccepted>> {
    return getApiClient().post<GenerateCourseAccepted>('/courses/generate', body);
  },

  /** List my generated courses, newest first. */
  async list(): Promise<ApiResponse<CourseSummary[]>> {
    return getApiClient().get<CourseSummary[]>('/courses');
  },

  /** Load one of my courses with its lessons. */
  async get(courseId: string): Promise<ApiResponse<CourseWithLessons>> {
    return getApiClient().get<CourseWithLessons>(
      `/courses/${encodeURIComponent(courseId)}`,
    );
  },
};
