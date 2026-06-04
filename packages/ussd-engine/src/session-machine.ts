/**
 * USSD session state machine.
 *
 * `handleUssdRequest` is the single entry point. It owns session lifecycle
 * (via the injected {@link UssdSessionStore}) and routes the dialer's input
 * through the bilingual menu tree to the right screen. All side effects are
 * injected ports; the routing itself is deterministic and unit-testable.
 *
 * Navigation model (Africa's Talking):
 *   - empty `text`           -> first dial -> resolve identity, show main menu
 *   - cumulative `text` "1*2" -> we act on the LAST segment only
 *   - "0" from any sub-screen -> back to main menu
 *
 * Hard rules honoured:
 *   - Single-language screens: the active locale alone (CLAUDE.md zero-mix).
 *   - No secrets on screen: USSD is plaintext; we render only references and
 *     statuses, never tokens.
 *   - Money path is NOT here: meter-reading records a raw utility reading
 *     only; rent settlement stays on the gateway's LedgerService.
 *
 * @module @bossnyumba/ussd-engine/session-machine
 */

import {
  USSD_SESSION_TIMEOUT_SECONDS,
  type UssdLanguage,
  type UssdRequest,
  type UssdResponse,
  type UssdSession,
  type UssdSessionState,
} from './types';
import {
  buildMainMenu,
  buildLeaseScreen,
  buildNoLeaseScreen,
  buildRentScreen,
  buildNoRentScreen,
  buildMeterReadingPrompt,
  buildMeterReadingConfirm,
  buildMeterReadingLoggedScreen,
  buildMaintenanceScreen,
  buildNoMaintenanceScreen,
  buildMarketplaceScreen,
  buildLanguageMenu,
  buildLanguageSetScreen,
  buildErrorScreen,
} from './menu-tree';
import {
  systemClock,
  type UssdAuditSink,
  type UssdClock,
  type UssdDataPort,
  type UssdIdentityResolver,
  type UssdSessionStore,
} from './ports';

// ----------------------------------------------------------------------------
// Engine dependencies
// ----------------------------------------------------------------------------

export interface UssdEngineDeps {
  readonly store: UssdSessionStore;
  readonly identity: UssdIdentityResolver;
  readonly data: UssdDataPort;
  readonly audit?: UssdAuditSink;
  readonly clock?: UssdClock;
  /** Default language when the member has no preference. BossNyumba: en. */
  readonly defaultLanguage?: UssdLanguage;
}

// ----------------------------------------------------------------------------
// Input parsing
// ----------------------------------------------------------------------------

/** Africa's Talking sends cumulative "1*2*3"; we act on the last segment. */
export function extractLatestInput(text: string): string {
  if (!text || text.trim().length === 0) return '';
  const parts = text.split('*');
  return (parts[parts.length - 1] ?? '').trim();
}

// ----------------------------------------------------------------------------
// Route result
// ----------------------------------------------------------------------------

interface RouteResult {
  readonly newState: UssdSessionState;
  readonly response: UssdResponse;
  readonly sessionData?: Readonly<Record<string, unknown>>;
  readonly newLanguage?: UssdLanguage;
}

// ----------------------------------------------------------------------------
// Session helpers
// ----------------------------------------------------------------------------

function computeExpiry(clock: UssdClock): string {
  return new Date(clock.now().getTime() + USSD_SESSION_TIMEOUT_SECONDS * 1000).toISOString();
}

function isExpired(session: UssdSession, clock: UssdClock): boolean {
  const exp = Date.parse(session.expiresAt);
  if (!Number.isFinite(exp)) return true;
  return clock.now().getTime() > exp;
}

async function freshSession(
  request: UssdRequest,
  deps: UssdEngineDeps,
  clock: UssdClock,
): Promise<UssdSession> {
  const identity = await safeResolve(deps.identity, request.phoneNumber);
  const now = clock.now().toISOString();
  const session: UssdSession = {
    sessionId: request.sessionId,
    phoneNumber: request.phoneNumber,
    tenantId: identity.tenantId,
    actorId: identity.actorId,
    tier: identity.tier,
    state: 'main_menu',
    language: identity.language ?? deps.defaultLanguage ?? 'en',
    data: {},
    createdAt: now,
    lastActivityAt: now,
    expiresAt: computeExpiry(clock),
  };
  return deps.store.create(session);
}

async function safeResolve(
  resolver: UssdIdentityResolver,
  phoneNumber: string,
): Promise<Awaited<ReturnType<UssdIdentityResolver['resolve']>>> {
  try {
    return await resolver.resolve(phoneNumber);
  } catch {
    return { tenantId: null, actorId: null, tier: 'anonymous' };
  }
}

// ----------------------------------------------------------------------------
// Per-state handlers
// ----------------------------------------------------------------------------

async function handleMainMenuInput(
  session: UssdSession,
  input: string,
  deps: UssdEngineDeps,
): Promise<RouteResult> {
  switch (input) {
    case '1':
      return handleLease(session, deps);
    case '2':
      return handleRent(session, deps);
    case '3':
      return handleMeterReadingStart(session);
    case '4':
      return handleMaintenance(session, deps);
    case '5':
      return handleMarketplace(session, deps);
    case '#':
      return languagePicker();
    default:
      return invalid(session);
  }
}

async function handleLease(session: UssdSession, deps: UssdEngineDeps): Promise<RouteResult> {
  const data = await safeFetch(() => deps.data.fetchLease(session));
  if (data === undefined) return generalError(session.language);
  if (data === null) {
    return {
      newState: 'lease',
      response: { message: buildNoLeaseScreen(session.language), isEnd: false },
    };
  }
  return {
    newState: 'lease_detail',
    response: { message: buildLeaseScreen(data, session.language), isEnd: false },
  };
}

async function handleRent(session: UssdSession, deps: UssdEngineDeps): Promise<RouteResult> {
  const data = await safeFetch(() => deps.data.fetchRent(session));
  if (data === undefined) return generalError(session.language);
  if (data === null) {
    return {
      newState: 'rent',
      response: { message: buildNoRentScreen(session.language), isEnd: false },
    };
  }
  return {
    newState: 'rent_detail',
    response: { message: buildRentScreen(data, session.language), isEnd: false },
  };
}

function handleMeterReadingStart(session: UssdSession): RouteResult {
  return {
    newState: 'meter_reading_amount',
    response: { message: buildMeterReadingPrompt(session.language), isEnd: false },
  };
}

async function handleMeterReadingAmount(session: UssdSession, input: string): Promise<RouteResult> {
  const units = Number(input.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(units) || units <= 0) {
    return {
      newState: 'meter_reading_amount',
      response: { message: buildErrorScreen('invalid', session.language), isEnd: false },
    };
  }
  return {
    newState: 'meter_reading_confirm',
    response: { message: buildMeterReadingConfirm(units, session.language), isEnd: false },
    sessionData: { ...session.data, pendingUnits: units },
  };
}

async function handleMeterReadingConfirm(
  session: UssdSession,
  input: string,
  deps: UssdEngineDeps,
): Promise<RouteResult> {
  if (input !== '1') {
    // "2" or anything else cancels back to the main menu.
    return back(session);
  }
  const units = Number(session.data.pendingUnits ?? 0);
  if (!Number.isFinite(units) || units <= 0) {
    return generalError(session.language);
  }
  const ok = await safeFetch(() => deps.data.recordMeterReading(session, units));
  if (ok === undefined || ok === false) {
    return generalError(session.language);
  }
  return {
    newState: 'main_menu',
    response: { message: buildMeterReadingLoggedScreen(session.language), isEnd: true },
    sessionData: { ...session.data, pendingUnits: undefined },
  };
}

async function handleMaintenance(session: UssdSession, deps: UssdEngineDeps): Promise<RouteResult> {
  const data = await safeFetch(() => deps.data.fetchMaintenance(session));
  if (data === undefined) return generalError(session.language);
  if (data === null) {
    return {
      newState: 'maintenance',
      response: { message: buildNoMaintenanceScreen(session.language), isEnd: false },
    };
  }
  return {
    newState: 'maintenance',
    response: { message: buildMaintenanceScreen(data, session.language), isEnd: false },
  };
}

async function handleMarketplace(session: UssdSession, deps: UssdEngineDeps): Promise<RouteResult> {
  const lines = await safeFetch(() => deps.data.fetchMarketplace(session));
  if (lines === undefined) return generalError(session.language);
  return {
    newState: 'marketplace',
    response: { message: buildMarketplaceScreen(lines, session.language), isEnd: false },
  };
}

function languagePicker(): RouteResult {
  return {
    newState: 'language_switch',
    response: { message: buildLanguageMenu(), isEnd: false },
  };
}

function handleLanguageInput(input: string): RouteResult {
  if (input === '1' || input === '2') {
    const lang: UssdLanguage = input === '1' ? 'en' : 'sw';
    return {
      newState: 'main_menu',
      newLanguage: lang,
      response: { message: buildLanguageSetScreen(lang), isEnd: false },
    };
  }
  return languagePicker();
}

// ----------------------------------------------------------------------------
// Shared route helpers
// ----------------------------------------------------------------------------

function back(session: UssdSession): RouteResult {
  return {
    newState: 'main_menu',
    response: { message: buildMainMenu(session.language, session.tier), isEnd: false },
  };
}

function invalid(session: UssdSession): RouteResult {
  return {
    newState: session.state,
    response: { message: buildErrorScreen('invalid', session.language), isEnd: false },
  };
}

function generalError(lang: UssdLanguage): RouteResult {
  return {
    newState: 'main_menu',
    response: { message: buildErrorScreen('general', lang), isEnd: true },
  };
}

/**
 * Run a fetcher fail-soft. Returns the value, `null` when the fetcher
 * returned null, or `undefined` to signal the fetcher threw (caller renders
 * a generic error). This keeps the three outcomes type-distinguishable.
 */
async function safeFetch<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

// ----------------------------------------------------------------------------
// Router
// ----------------------------------------------------------------------------

async function resolveInput(
  session: UssdSession,
  input: string,
  deps: UssdEngineDeps,
): Promise<RouteResult> {
  // "0" from any sub-screen returns to the main menu.
  if (input === '0' && session.state !== 'initial' && session.state !== 'main_menu') {
    return back(session);
  }

  switch (session.state) {
    case 'initial':
    case 'main_menu':
      return handleMainMenuInput(session, input, deps);
    case 'meter_reading':
      return handleMeterReadingStart(session);
    case 'meter_reading_amount':
      return handleMeterReadingAmount(session, input);
    case 'meter_reading_confirm':
      return handleMeterReadingConfirm(session, input, deps);
    case 'language_switch':
      return handleLanguageInput(input);
    // Read-only leaves: any key returns to the menu.
    case 'lease':
    case 'lease_detail':
    case 'rent':
    case 'rent_detail':
    case 'maintenance':
    case 'marketplace':
    case 'marketplace_detail':
      return back(session);
    default:
      return back(session);
  }
}

// ----------------------------------------------------------------------------
// Entry point
// ----------------------------------------------------------------------------

/**
 * Handle one inbound USSD request and return the screen to display.
 *
 * Fail-closed on internal error: any uncaught failure renders a terminal
 * generic-error screen rather than leaking a stack trace to the gateway.
 */
export async function handleUssdRequest(
  request: UssdRequest,
  deps: UssdEngineDeps,
): Promise<UssdResponse> {
  const clock = deps.clock ?? systemClock;
  const lang = deps.defaultLanguage ?? 'en';

  try {
    const input = extractLatestInput(request.text);

    // First dial — empty text.
    if (input === '') {
      const session = await freshSession(request, deps, clock);
      const message = buildMainMenu(session.language, session.tier);
      emitAudit(deps, request, message, false);
      return { message, isEnd: false };
    }

    // Existing session.
    const existing = await deps.store.get(request.sessionId);
    if (!existing || isExpired(existing, clock)) {
      if (existing) await deps.store.end(request.sessionId);
      const message = buildErrorScreen('timeout', lang);
      emitAudit(deps, request, message, true);
      return { message, isEnd: true };
    }

    const result = await resolveInput(existing, input, deps);

    await deps.store.update(existing.sessionId, {
      state: result.newState,
      ...(result.newLanguage ? { language: result.newLanguage } : {}),
      ...(result.sessionData ? { data: result.sessionData } : {}),
    });

    if (result.response.isEnd) {
      await deps.store.end(existing.sessionId);
    }

    emitAudit(deps, request, result.response.message, result.response.isEnd);
    return result.response;
  } catch {
    const message = buildErrorScreen('general', lang);
    emitAudit(deps, request, message, true);
    return { message, isEnd: true };
  }
}

function emitAudit(
  deps: UssdEngineDeps,
  request: UssdRequest,
  response: string,
  isEnd: boolean,
): void {
  if (!deps.audit) return;
  try {
    deps.audit.log({
      sessionId: request.sessionId,
      phoneNumber: request.phoneNumber,
      serviceCode: request.serviceCode,
      input: request.text,
      response,
      isEnd,
    });
  } catch {
    // Audit is best-effort; never break the response on a logging failure.
  }
}
