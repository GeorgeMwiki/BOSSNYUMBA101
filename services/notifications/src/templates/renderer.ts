/**
 * Template renderer - substitutes variables in template strings
 * Supports {{variable}} syntax
 */

export type TemplateData = Record<string, string>;

/**
 * Replaces {{key}} placeholders with values from data
 * @param text - Template string with {{variable}} placeholders
 * @param data - Key-value pairs to substitute
 * @returns Rendered string with variables replaced
 */
export function renderTemplate(text: string, data: TemplateData): string {
  let result = text;
  for (const [key, value] of Object.entries(data)) {
    // eslint-disable-next-line security/detect-non-literal-regexp -- reason: key is an internal TemplateData property name from a trusted caller-controlled object, not user-supplied input; braces are literal, not regex metacharacters in this context
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(placeholder, value ?? '');
  }
  return result;
}
