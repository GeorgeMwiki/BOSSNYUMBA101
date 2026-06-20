// Deploy ONE BossNyumba web app to Vercel as its own monorepo-rooted project.
// Usage: node scripts/deploy-app-vercel.mjs <app-dir> <next|vite> <project-name>
// Reuses the machine's stored Vercel CLI token. Creates+configures the project
// (rootDirectory + framework + monorepo install/build + env + public), then
// triggers an archived deploy of the whole monorepo. Never prints secret values.
import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';

const [APP, FW, PROJ] = process.argv.slice(2);
const SCOPE = 'mwiki';
const SITE = `https://${PROJ}.vercel.app`;
const PREFIX = FW === 'vite' ? 'VITE_' : 'NEXT_PUBLIC_';
const TOKEN = JSON.parse(fs.readFileSync(os.homedir() + '/Library/Application Support/com.vercel.cli/auth.json', 'utf8')).token;
const TEAM = JSON.parse(fs.readFileSync('apps/marketing/.vercel/project.json', 'utf8')).orgId;
const api = async (method, path, body) => {
  const r = await fetch(`https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${TEAM}`, {
    method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

// ── shared real values from whichever app .env.local carries them ───────────
const readEnvFile = (p) => {
  const out = {};
  try {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z][A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  } catch {}
  return out;
};
const shared = {};
for (const app of fs.readdirSync('apps')) Object.assign(shared, readEnvFile(`apps/${app}/.env.local`), shared);
Object.assign(shared, readEnvFile('.env.local'), shared); // root last-resort, don't overwrite
const SUPA_URL = shared.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPA_KEY = shared.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const API_URL = shared.NEXT_PUBLIC_API_URL || shared.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.bossnyumba.app';

// ── per-app env: real from its own .env.local first, then a superset of guards ─
const env = {};
for (const [k, v] of Object.entries(readEnvFile(`apps/${APP}/.env.local`))) if (k.startsWith(PREFIX)) env[k] = v;
const fill = (k, v) => { if (!env[k]) env[k] = v; };
if (PREFIX === 'NEXT_PUBLIC_') {
  fill('NEXT_PUBLIC_SUPABASE_URL', SUPA_URL); fill('NEXT_PUBLIC_SUPABASE_ANON_KEY', SUPA_KEY);
  fill('NEXT_PUBLIC_API_URL', API_URL); fill('NEXT_PUBLIC_API_BASE_URL', API_URL);
  fill('NEXT_PUBLIC_API_GATEWAY_URL', API_URL); fill('NEXT_PUBLIC_API_BASE', API_URL);
  fill('NEXT_PUBLIC_APP_URL', SITE); fill('NEXT_PUBLIC_PLATFORM_PORTAL_BASE_URL', SITE);
  fill('NEXT_PUBLIC_OWNER_PORTAL_URL', 'https://owner.bossnyumba.app');
  fill('NEXT_PUBLIC_OWNER_WEB_URL', 'https://owner.bossnyumba.app');
  fill('NEXT_PUBLIC_OWNER_WEB_ORIGIN', 'https://owner.bossnyumba.app');
  fill('NEXT_PUBLIC_MARKETING_SITE_URL', 'https://bossnyumba-marketing.vercel.app');
  fill('NEXT_PUBLIC_DEFAULT_COUNTRY', 'TZ'); fill('NEXT_PUBLIC_ENABLE_WEB_VITALS', 'false');
  fill('NEXT_PUBLIC_SESSION_REPLAY_ENABLED', 'false'); fill('NEXT_PUBLIC_TENANT_COUNTRY', 'TZ');
  fill('NEXT_PUBLIC_TENANT_CURRENCY', 'TZS'); fill('NEXT_PUBLIC_TENANT_LOCALE', 'en');
} else {
  fill('VITE_API_URL', API_URL); fill('VITE_SUPABASE_URL', SUPA_URL); fill('VITE_SUPABASE_ANON_KEY', SUPA_KEY);
  fill('VITE_OWNER_PORTAL_URL', 'https://owner.bossnyumba.app'); fill('VITE_PLATFORM_PORTAL_URL', SITE);
}
const environmentVariables = Object.entries(env).map(([key, value]) => ({ key, value: String(value), type: 'plain', target: ['production', 'preview'] }));

const framework = FW === 'vite' ? 'vite' : 'nextjs';
const installCommand = 'cd ../.. && pnpm install --frozen-lockfile';
const buildCommand = `cd ../.. && pnpm --filter @bossnyumba/${APP}... build`;
const settings = { rootDirectory: `apps/${APP}`, framework, installCommand, buildCommand };

// ── create or update project ────────────────────────────────────────────────
let pid;
const created = await api('POST', '/v11/projects', { name: PROJ, ...settings, environmentVariables });
if (created.status < 300) pid = created.json.id;
else {
  const got = await api('GET', `/v9/projects/${PROJ}`);
  pid = got.json.id;
  await api('PATCH', `/v9/projects/${pid}`, settings);
}
if (!pid) { console.error(`FAIL(${APP}): no project id —`, JSON.stringify(created.json).slice(0, 200)); process.exit(1); }
// SECURITY: ONLY the public marketing site (or an explicit --public flag) has
// deployment protection stripped. PRIVILEGED surfaces (admin-web, owner-web)
// KEEP Vercel protection — their own app gate is a presence-only UX redirect,
// not auth, so the edge barrier matters. Never blanket-public every app.
const PUBLIC = APP === 'marketing' || process.argv.includes('--public');
if (PUBLIC) {
  await api('PATCH', `/v9/projects/${pid}`, { ssoProtection: null });
  console.log(`  ${APP}: PUBLIC (deployment protection disabled)`);
} else {
  console.log(`  ${APP}: PRIVILEGED (deployment protection LEFT ON — pass --public to override)`);
}
console.log(`PROJECT(${APP})=${pid}  site=${SITE}  env=${environmentVariables.length}`);

// ── deploy: link root .vercel to this project, archived deploy of the monorepo ─
fs.mkdirSync('.vercel', { recursive: true });
fs.writeFileSync('.vercel/project.json', JSON.stringify({ projectId: pid, orgId: TEAM }));
let out = '';
try {
  out = execSync(`npx vercel deploy --prod --archive=tgz --scope ${SCOPE}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
} catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
const clean = out.replace(/\x1b\[[0-9;]*m/g, '');
const url = (clean.match(new RegExp(`https://${PROJ}-[a-z0-9]+-${SCOPE}\\.vercel\\.app`)) || [])[0] || '';
console.log(`DEPLOY(${APP}) ${url || '(triggered — see log)'}`);
console.log(clean.split('\n').filter(Boolean).slice(-3).join('\n'));
