/**
 * Course generator — prompt templates.
 *
 * Builds the system prompt (estate-management curriculum designer) and the
 * user prompt for the brain/LLM router. Language-aware: an `en` course is
 * entirely English, an `sw` course entirely Swahili — the two are NEVER mixed
 * on one course (CLAUDE.md absolute-locale rule).
 *
 * Customer-facing strings carry ZERO em dashes (commas, colons, periods,
 * semicolons only).
 *
 * Ported from LitFin's `core/learning-generator/prompt-templates.ts` and
 * retargeted financial-literacy → estate management.
 *
 * @module courses/prompt-templates
 */

import {
  MIN_LESSONS,
  MAX_LESSONS,
  QUIZ_QUESTIONS_PER_LESSON,
  QUIZ_OPTIONS_PER_QUESTION,
  type GenerateCourseInput,
} from './schema.js';

function languageDirective(language: GenerateCourseInput['language']): string {
  if (language === 'sw') {
    return [
      'LUGHA: Andika kila kitu kwa Kiswahili pekee.',
      'Usichanganye Kiingereza na Kiswahili. Vichwa, maudhui, malengo,',
      'mambo muhimu, na maswali yote lazima yawe kwa Kiswahili.',
    ].join(' ');
  }
  return [
    'LANGUAGE: Write everything in English only.',
    'Do not mix Swahili with English. Titles, content, objectives,',
    'key takeaways, and all quiz questions must be in English.',
  ].join(' ');
}

/**
 * The curriculum-designer persona + the strict JSON contract. The contract is
 * intentionally explicit because the model output is parsed and zod-validated;
 * any drift fails the parse and triggers a single retry.
 */
export function buildSystemPrompt(
  language: GenerateCourseInput['language'],
): string {
  return [
    'You are an estate-management curriculum designer for landlords, leasing',
    'agents, caretakers, and portfolio managers across Tanzania and East',
    'Africa. You design practical, plain-language courses that a first-time',
    'property manager can follow without prior training. Use concrete, locally',
    'relevant examples (mobile money rent collection, market-town blocks,',
    'housing cooperatives, seasonal occupancy). Keep arithmetic simple and',
    'always explain the why before the how.',
    '',
    languageDirective(language),
    '',
    'STYLE RULES:',
    '- Never use em dashes. Use commas, colons, periods, or semicolons.',
    '- Speak about lenders, banks, and authorities generically; do not name a',
    '  specific commercial bank or company as an example.',
    '- Be encouraging and concrete; avoid jargon, define any term you must use.',
    '- Never invent legal thresholds you are unsure of; teach the principle and',
    '  tell the learner to confirm local figures.',
    '',
    'OUTPUT CONTRACT (CRITICAL):',
    'Return ONE JSON object and nothing else. No prose before or after, no',
    'markdown code fences. The object MUST match this exact shape:',
    '{',
    '  "title": string,',
    '  "summary": string,',
    '  "difficulty": "beginner" | "intermediate" | "advanced",',
    '  "lessons": [',
    '    {',
    '      "title": string,',
    '      "objectives": string[]   (1 to 6 short learning objectives),',
    '      "content": string        (the lesson body as Markdown),',
    '      "keyTakeaways": string[] (1 to 8 concise takeaways),',
    '      "quiz": [',
    '        {',
    '          "question": string,',
    `          "options": string[]  (exactly ${QUIZ_OPTIONS_PER_QUESTION} answer options),`,
    '          "correctOptionIndex": number (0-based index of the correct option),',
    '          "explanation": string (why the correct answer is correct)',
    '        }',
    `        ... exactly ${QUIZ_QUESTIONS_PER_LESSON} questions per lesson`,
    '      ],',
    '      "estimatedMinutes": number (realistic minutes to complete the lesson)',
    '    }',
    `    ... between ${MIN_LESSONS} and ${MAX_LESSONS} lessons`,
    '  ]',
    '}',
    '',
    'Order lessons so each one builds on the previous. The Markdown content',
    'should use headings, short paragraphs, and bullet lists where helpful.',
  ].join('\n');
}

function renderDocumentContext(input: GenerateCourseInput): string {
  const docs = input.documentContext ?? [];
  if (docs.length === 0) return '';
  const lines = docs.map((d, i) => {
    const label = d.documentName || `Document ${i + 1}`;
    const type = d.documentType ? ` (${d.documentType})` : '';
    const summary = d.summary.trim() ? d.summary.trim() : 'no extract available';
    return `- ${label}${type}: ${summary}`;
  });
  return [
    '',
    'The learner attached the following documents from their own portfolio.',
    'Ground the examples and the operational lessons in this real context',
    'where it helps; do not invent figures that contradict it:',
    ...lines,
  ].join('\n');
}

export function buildUserPrompt(input: GenerateCourseInput): string {
  const domainLabel = input.domainLabel?.trim() || input.domain;
  return [
    'Design an estate-management course for this learner.',
    '',
    `Topic area: ${domainLabel}`,
    `Target difficulty: ${input.difficulty}`,
    '',
    "Scenario in the learner's own words:",
    input.scenarioDescription.trim(),
    renderDocumentContext(input),
    '',
    `Produce between ${MIN_LESSONS} and ${MAX_LESSONS} lessons. Tailor the`,
    'topics to this specific situation: cover what this manager most needs to',
    'run their property well. Return only the JSON object.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
