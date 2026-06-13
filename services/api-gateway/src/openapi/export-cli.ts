/**
 * OpenAPI export CLI — writes the live-generated spec to disk so CI
 * can diff it against the committed copy and so API consumers can
 * bundle the spec without booting the gateway.
 *
 * Run via: `pnpm -F @bossnyumba/api-gateway openapi:export`
 *
 * Output path: `Docs/api/openapi.generated.json` (monorepo root).
 *
 * The script imports the compiled router graph to harvest routes. It
 * stubs out env-var preconditions (API keys, DB URL) so it can run
 * without a full boot — the schemas and route shapes are static.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Hono } from 'hono';
import { generateOpenApiDocument } from '../openapi';
import type { MountedRouter } from './route-harvester';

// Relax preconditions for CLI use — we do NOT want to require
// DATABASE_URL or INTERNAL_API_KEY just to emit a spec.
process.env.OUTBOX_WORKER_DISABLED = 'true';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000';
if (!process.env.INTERNAL_API_KEY) process.env.INTERNAL_API_KEY = 'dev-cli-export-key';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'dev-cli-export-secret';

// Lazy imports so env defaults above land before module init.
type RouterModule = { default?: unknown } & Record<string, unknown>;

async function loadRouters(): Promise<MountedRouter[]> {
  const [
    auth,
    authMfa,
    tenants,
    users,
    properties,
    units,
    customers,
    leases,
    invoices,
    payments,
    workOrders,
    vendors,
    notifications,
    reports,
    dashboard,
    onboarding,
    feedback,
    complaints,
    inspections,
    documents,
    scheduling,
    messaging,
    cases,
    brain,
    maintenance,
    hr,
    applications,
    arrears,
    compliance,
    docChat,
    documentRender,
    financialProfile,
    gamification,
    gepg,
    interactiveReports,
    letters,
    marketplace,
    negotiations,
    occupancyTimeline,
    renewals,
    riskReports,
    scans,
    stationMasterCoverage,
    tenders,
    waitlist,
  ] = await Promise.all([
    import('../routes/auth.js'),
    import('../routes/auth-mfa.js'),
    import('../routes/tenants.hono.js'),
    import('../routes/users.hono.js'),
    import('../routes/properties.js'),
    import('../routes/units.js'),
    import('../routes/customers.js'),
    import('../routes/leases.js'),
    import('../routes/invoices.js'),
    import('../routes/payments.js'),
    import('../routes/work-orders.hono.js'),
    import('../routes/vendors.hono.js'),
    import('../routes/notifications.js'),
    import('../routes/reports.hono.js'),
    import('../routes/dashboard.hono.js'),
    import('../routes/onboarding.js'),
    import('../routes/feedback.js'),
    import('../routes/complaints.js'),
    import('../routes/inspections.js'),
    import('../routes/documents.hono.js'),
    import('../routes/scheduling.js'),
    import('../routes/messaging.js'),
    import('../routes/cases.hono.js'),
    import('../routes/brain.hono.js'),
    import('../routes/maintenance.hono.js'),
    import('../routes/hr.hono.js'),
    import('../routes/applications.hono.js'),
    import('../routes/arrears.hono.js'),
    import('../routes/compliance.hono.js'),
    import('../routes/doc-chat.hono.js'),
    import('../routes/document-render.hono.js'),
    import('../routes/financial-profile.hono.js'),
    import('../routes/gamification.hono.js'),
    import('../routes/gepg.hono.js'),
    import('../routes/interactive-reports.hono.js'),
    import('../routes/letters.hono.js'),
    import('../routes/marketplace.hono.js'),
    import('../routes/negotiations.hono.js'),
    import('../routes/occupancy-timeline.hono.js'),
    import('../routes/renewals.hono.js'),
    import('../routes/risk-reports.hono.js'),
    import('../routes/scans.hono.js'),
    import('../routes/station-master-coverage.hono.js'),
    import('../routes/tenders.hono.js'),
    import('../routes/waitlist.hono.js'),
  ]);

  // Routers are exported under inconsistent names (default export vs.
  // named export like `authRouter`, `fooApp`). Pick the first Hono
  // instance from each module.
  const pick = (mod: RouterModule, preferred: string[] = []): Hono | undefined => {
    for (const k of preferred) if (mod[k]) return mod[k] as Hono;
    if (mod.default) return mod.default as Hono;
    for (const v of Object.values(mod)) if (v && typeof v === 'object' && 'routes' in (v as object)) return v as Hono;
    return undefined;
  };

  const entries: Array<[string, RouterModule, string[], string]> = [
    ['/auth', auth, ['authRouter'], 'auth'],
    ['/auth/mfa', authMfa, ['authMfaRouter'], 'auth'],
    ['/tenants', tenants, ['tenantsRouter'], 'tenants'],
    ['/users', users, ['usersRouter'], 'users'],
    ['/properties', properties, ['propertiesRouter'], 'properties'],
    ['/units', units, ['unitsRouter'], 'units'],
    ['/customers', customers, ['customersRouter'], 'customers'],
    ['/leases', leases, ['leasesRouter'], 'leases'],
    ['/invoices', invoices, ['invoicesApp'], 'invoices'],
    ['/payments', payments, ['paymentsApp'], 'payments'],
    ['/work-orders', workOrders, ['workOrdersRouter'], 'work-orders'],
    ['/vendors', vendors, ['vendorsRouter'], 'vendors'],
    ['/notifications', notifications, ['notificationsRouter'], 'notifications'],
    ['/reports', reports, ['reportsHonoRouter'], 'reports'],
    ['/dashboard', dashboard, ['dashboardRouter'], 'dashboard'],
    ['/onboarding', onboarding, ['onboardingRouter'], 'onboarding'],
    ['/feedback', feedback, ['feedbackRouter'], 'feedback'],
    ['/complaints', complaints, ['complaintsRouter'], 'complaints'],
    ['/inspections', inspections, ['inspectionsRouter'], 'inspections'],
    ['/documents', documents, ['documentsHonoRouter'], 'documents'],
    ['/scheduling', scheduling, ['schedulingRouter'], 'scheduling'],
    ['/messaging', messaging, ['messagingRouter'], 'messaging'],
    ['/cases', cases, ['casesRouter'], 'cases'],
    ['/brain', brain, ['brainRouter'], 'brain'],
    ['/maintenance', maintenance, ['maintenanceRouter'], 'maintenance'],
    ['/hr', hr, ['hrRouter'], 'hr'],
    ['/applications', applications, [], 'applications'],
    ['/arrears', arrears, [], 'arrears'],
    ['/compliance', compliance, [], 'compliance'],
    ['/doc-chat', docChat, [], 'doc-chat'],
    ['/document-render', documentRender, [], 'document-render'],
    ['/financial-profile', financialProfile, [], 'financial-profile'],
    ['/gamification', gamification, [], 'gamification'],
    ['/gepg', gepg, [], 'gepg'],
    ['/interactive-reports', interactiveReports, [], 'interactive-reports'],
    ['/letters', letters, [], 'letters'],
    ['/marketplace', marketplace, ['marketplaceRouter'], 'marketplace'],
    ['/negotiations', negotiations, ['negotiationsRouter'], 'negotiations'],
    ['/occupancy-timeline', occupancyTimeline, [], 'occupancy-timeline'],
    ['/renewals', renewals, [], 'renewals'],
    ['/risk-reports', riskReports, [], 'risk-reports'],
    ['/scans', scans, [], 'scans'],
    ['/station-master-coverage', stationMasterCoverage, [], 'station-master-coverage'],
    ['/tenders', tenders, ['tendersRouter'], 'tenders'],
    ['/waitlist', waitlist, ['waitlistRouter'], 'waitlist'],
  ];

  const mounted: MountedRouter[] = [];
  for (const [prefix, mod, preferred, defaultTag] of entries) {
    const app = pick(mod as RouterModule, preferred);
    if (app) mounted.push({ prefix, app, defaultTag });
    else {
      console.warn(`openapi-export: could not resolve a Hono app for prefix ${prefix}`);
    }
  }
  return mounted;
}

async function main(): Promise<void> {
  const outputPath =
    process.argv[2] ??
    resolve(process.cwd(), '..', '..', 'Docs', 'api', 'openapi.generated.json');

  // Ensure manifests register before spec generation.
  await import('./manifests.js');

  const routers = await loadRouters();
  const spec = generateOpenApiDocument({
    title: 'BOSSNYUMBA API',
    version: process.env.APP_VERSION ?? '1.0.0',
    description:
      'BOSSNYUMBA multi-tenant property management platform — full HTTP API. ' +
      'Generated from the gateway source at build time.',
    servers: [
      { url: '/api/v1', description: 'Default' },
    ],
    mountedRouters: routers,
  });

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- outputPath is a CLI-arg-derived path scoped to the build dir, validated by the caller; no untrusted input reaches the fs.
  await mkdir(dirname(outputPath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- same: outputPath is a build artifact path, not user-influenced at runtime.
  await writeFile(outputPath, JSON.stringify(spec, null, 2) + '\n', 'utf8');

  const pathCount = Object.keys((spec as { paths?: Record<string, unknown> }).paths ?? {}).length;
  // eslint-disable-next-line no-console
  console.log(`openapi-export: wrote ${pathCount} paths to ${outputPath}`);
}

main().catch((err) => {
  console.error('openapi-export failed:', err);
  process.exit(1);
});
