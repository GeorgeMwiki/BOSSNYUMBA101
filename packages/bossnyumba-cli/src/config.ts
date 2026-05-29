/**
 * Runtime config helpers — defaults shared by every CLI verb.
 */

export const DEFAULT_API_BASE_URL =
  process.env['BOSSNYUMBA_API_BASE_URL'] ?? 'https://api.bossnyumba.app';

export const DEFAULT_CLIENT_ID = 'bossnyumba-cli';
export const DEFAULT_CLIENT_LABEL = 'BossNyumba CLI (local)';

export const DEFAULT_SCOPES: readonly string[] = [
  'owner:read',
  'owner:write',
  'owner:draft',
  'owner:reminders',
  'owner:share',
];
