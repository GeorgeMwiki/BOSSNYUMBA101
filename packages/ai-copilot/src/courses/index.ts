/**
 * Course generator — public API.
 *
 * Generates AI estate-management courses for the coworker create-course flow
 * (domain + scenario + optional documents → a strict, validated course of 5 to
 * 8 lessons). Honest-degrade: an LLM produces the course when wired, otherwise
 * the deterministic sequencer builds a real course from `ESTATE_CONCEPTS`.
 *
 * `CourseGenerator` / `getCourseGenerator` may be handed an `LLMLike` that
 * pulls the model layer (server-only); the generator itself has no model
 * import. The schema + domains modules are isomorphic and safe to import on the
 * FE through the `@bossnyumba/ai-copilot/courses` subpath export (this avoids
 * the NodeNext `export *` barrel TS2709 type-vs-namespace defect that bites
 * type-only imports from the package root).
 *
 * @module courses
 */

export {
  CourseGenerator,
  getCourseGenerator,
  type LLMLike,
  type CourseGeneratorDeps,
  type GenerateCourseResult,
} from './course-generator.js';

export {
  buildDeterministicCourse,
  selectConcepts,
} from './deterministic-sequencer.js';

export { buildSystemPrompt, buildUserPrompt } from './prompt-templates.js';

export {
  COURSE_DOMAINS,
  findCourseDomain,
  courseDomainLabel,
  type CourseDomain,
} from './domains.js';

export {
  GeneratedQuizQuestionSchema,
  GeneratedLessonSchema,
  GeneratedCourseSchema,
  GenerateCourseInputSchema,
  MIN_LESSONS,
  MAX_LESSONS,
  QUIZ_QUESTIONS_PER_LESSON,
  QUIZ_OPTIONS_PER_QUESTION,
  COURSE_LANGUAGES,
  COURSE_DIFFICULTIES,
  type GeneratedQuizQuestion,
  type GeneratedLesson,
  type GeneratedCourse,
  type GenerateCourseInput,
  type CourseDocumentContext,
  type CourseLanguage,
  type CourseDifficulty,
  type CourseStatus,
  type CourseGenerationSource,
  type CourseLessonRow,
  type CourseSummary,
  type CourseWithLessons,
} from './schema.js';
