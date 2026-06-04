/**
 * USSD menu tree — pure bilingual screen builders.
 *
 * Every function is pure: no I/O, no clock, no env, no mutation. Output is
 * clamped to the 182-char USSD budget. Screens are STRICTLY single-language
 * per the active locale — when `en` is active no Swahili appears and vice
 * versa (the language-switch picker is the one allowed bilingual screen, since
 * the user has no language set yet).
 *
 * Real-estate menu:
 *   1. Lease     (Mkataba)
 *   2. Rent      (Kodi)
 *   3. Submit reading (Soma mita)
 *   4. Maintenance    (Matengenezo)
 *   5. Vacant units   (Nyumba wazi)
 *   #. Language       (Lugha)
 *
 * @module @bossnyumba/ussd-engine/menu-tree
 */

import {
  USSD_MAX_CHARS,
  type UssdLanguage,
  type UssdMenu,
  type UssdMenuNode,
  type UssdLeaseData,
  type UssdRentData,
  type UssdMaintenanceData,
  type UssdMarketplaceLine,
  type UssdTier,
} from './types';

// ----------------------------------------------------------------------------
// Bilingual label table
// ----------------------------------------------------------------------------

const LABELS = {
  welcome: { en: 'BossNyumba', sw: 'BossNyumba' },
  lease: { en: 'My Lease', sw: 'Mkataba Wangu' },
  rent: { en: 'Rent Due', sw: 'Kodi' },
  submitReading: { en: 'Submit Reading', sw: 'Soma Mita' },
  maintenance: { en: 'Maintenance', sw: 'Matengenezo' },
  market: { en: 'Vacant Units', sw: 'Nyumba Wazi' },
  language: { en: 'Language', sw: 'Lugha' },
  back: { en: 'Back', sw: 'Rudi' },
  status: { en: 'Status', sw: 'Hali' },
  expires: { en: 'Expires', sw: 'Inaisha' },
  daysLeft: { en: 'days left', sw: 'siku zimebaki' },
  due: { en: 'Due', sw: 'Inadaiwa' },
  paid: { en: 'Paid', sw: 'Imelipwa' },
  next: { en: 'Next', sw: 'Ifuatayo' },
  summary: { en: 'Summary', sw: 'Muhtasari' },
  reference: { en: 'Ref', sw: 'Kumb' },
  enterUnits: {
    en: 'Enter meter reading in units, then send:',
    sw: 'Weka usomaji wa mita kwa vizio, kisha tuma:',
  },
  confirmReading: { en: 'Confirm reading of', sw: 'Thibitisha usomaji wa' },
  units: { en: 'u', sw: 'u' },
  yes: { en: 'Yes', sw: 'Ndiyo' },
  no: { en: 'No', sw: 'Hapana' },
  logged: { en: 'Reading submitted. Asante.', sw: 'Usomaji umetumwa. Asante.' },
  selectUnit: { en: 'Select unit:', sw: 'Chagua nyumba:' },
  noLease: {
    en: 'No active lease on file.',
    sw: 'Hakuna mkataba hai.',
  },
  noRent: {
    en: 'No rent on file yet.',
    sw: 'Hakuna kodi bado.',
  },
  noMaintenance: {
    en: 'No maintenance request on file.',
    sw: 'Hakuna ombi la matengenezo.',
  },
  noMarket: {
    en: 'No vacant units available.',
    sw: 'Hakuna nyumba wazi.',
  },
  langSet: {
    en: 'Language set to English.',
    sw: 'Lugha imewekwa Kiswahili.',
  },
  errGeneral: {
    en: 'Something went wrong. Dial again.',
    sw: 'Hitilafu imetokea. Piga tena.',
  },
  errInvalid: {
    en: 'Invalid choice. Try again.',
    sw: 'Chaguo batili. Jaribu tena.',
  },
  errTimeout: {
    en: 'Session expired. Dial again.',
    sw: 'Muda umeisha. Piga tena.',
  },
  errNotLinked: {
    en: 'Phone not linked to a property. Contact your manager.',
    sw: 'Simu haijaunganishwa na nyumba. Wasiliana na meneja.',
  },
} as const;

type LabelKey = keyof typeof LABELS;

function t(key: LabelKey, lang: UssdLanguage): string {
  return LABELS[key][lang];
}

// ----------------------------------------------------------------------------
// Truncation
// ----------------------------------------------------------------------------

/** Clamp text to the USSD screen budget, appending an ellipsis if cut. */
export function truncateToUssd(
  text: string,
  maxChars: number = USSD_MAX_CHARS,
): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

// ----------------------------------------------------------------------------
// Static menu tree
// ----------------------------------------------------------------------------

/**
 * Build the static menu tree. Dynamic leaves (lease/rent/maintenance/market)
 * carry no options here; their screens are rendered at request time from
 * injected data by the dedicated builders below.
 */
export function buildMenuTree(): UssdMenu {
  const root: UssdMenuNode = {
    id: 'main_menu',
    titleEn: LABELS.welcome.en,
    titleSw: LABELS.welcome.sw,
    options: [
      { key: '1', labelEn: LABELS.lease.en, labelSw: LABELS.lease.sw, targetState: 'lease', minTier: 'tenant' },
      { key: '2', labelEn: LABELS.rent.en, labelSw: LABELS.rent.sw, targetState: 'rent', minTier: 'tenant' },
      { key: '3', labelEn: LABELS.submitReading.en, labelSw: LABELS.submitReading.sw, targetState: 'meter_reading', minTier: 'tenant' },
      { key: '4', labelEn: LABELS.maintenance.en, labelSw: LABELS.maintenance.sw, targetState: 'maintenance', minTier: 'tenant' },
      { key: '5', labelEn: LABELS.market.en, labelSw: LABELS.market.sw, targetState: 'marketplace', minTier: 'anonymous' },
      { key: '#', labelEn: LABELS.language.en, labelSw: LABELS.language.sw, targetState: 'language_switch', minTier: 'anonymous' },
    ],
    isDynamic: false,
  };

  const dynamic = (id: UssdMenuNode['id'], en: string, sw: string): UssdMenuNode => ({
    id,
    titleEn: en,
    titleSw: sw,
    options: [],
    isDynamic: true,
  });

  const languageNode: UssdMenuNode = {
    id: 'language_switch',
    titleEn: 'Select language',
    titleSw: 'Chagua lugha',
    options: [
      { key: '1', labelEn: 'English', labelSw: 'English', targetState: 'main_menu', minTier: 'anonymous' },
      { key: '2', labelEn: 'Kiswahili', labelSw: 'Kiswahili', targetState: 'main_menu', minTier: 'anonymous' },
    ],
    isDynamic: false,
  };

  return {
    root,
    nodes: {
      main_menu: root,
      lease: dynamic('lease', LABELS.lease.en, LABELS.lease.sw),
      rent: dynamic('rent', LABELS.rent.en, LABELS.rent.sw),
      meter_reading: dynamic('meter_reading', LABELS.submitReading.en, LABELS.submitReading.sw),
      maintenance: dynamic('maintenance', LABELS.maintenance.en, LABELS.maintenance.sw),
      marketplace: dynamic('marketplace', LABELS.market.en, LABELS.market.sw),
      language_switch: languageNode,
    },
  };
}

// ----------------------------------------------------------------------------
// Tier visibility
// ----------------------------------------------------------------------------

const TIER_RANK: Readonly<Record<UssdTier, number>> = {
  anonymous: 0,
  tenant: 1,
  agent: 2,
  manager: 3,
  owner: 4,
};

/** True when `actual` meets or exceeds the option's `required` tier. */
export function tierSatisfies(actual: UssdTier, required: UssdTier): boolean {
  return TIER_RANK[actual] >= TIER_RANK[required];
}

// ----------------------------------------------------------------------------
// Main menu (tier-filtered)
// ----------------------------------------------------------------------------

/**
 * Render the main menu for a given language + tier. Options the caller's
 * tier cannot use are hidden, so a feature-phone anonymous caller only sees
 * the vacant units, while an owner sees everything. Keys stay stable (a hidden
 * 1 does not renumber 2) so muscle-memory and the router agree.
 */
export function buildMainMenu(lang: UssdLanguage, tier: UssdTier): string {
  const tree = buildMenuTree();
  const lines: string[] = [t('welcome', lang)];
  for (const opt of tree.root.options) {
    const required = opt.minTier ?? 'anonymous';
    if (!tierSatisfies(tier, required)) continue;
    lines.push(`${opt.key}. ${lang === 'sw' ? opt.labelSw : opt.labelEn}`);
  }
  return truncateToUssd(lines.join('\n'));
}

// ----------------------------------------------------------------------------
// Lease screen
// ----------------------------------------------------------------------------

export function buildLeaseScreen(data: UssdLeaseData, lang: UssdLanguage): string {
  const statusLabel = lang === 'sw' ? data.statusSw : data.statusEn;
  const lines = [
    `${t('lease', lang)}: ${data.leaseRef}`,
    `${t('status', lang)}: ${statusLabel}`,
    `${t('expires', lang)}: ${data.expiresOn} (${data.daysToExpiry} ${t('daysLeft', lang)})`,
    `0. ${t('back', lang)}`,
  ];
  return truncateToUssd(lines.join('\n'));
}

export function buildNoLeaseScreen(lang: UssdLanguage): string {
  return truncateToUssd([t('noLease', lang), `0. ${t('back', lang)}`].join('\n'));
}

// ----------------------------------------------------------------------------
// Rent screen
// ----------------------------------------------------------------------------

export function buildRentScreen(data: UssdRentData, lang: UssdLanguage): string {
  const next = lang === 'sw' ? data.nextActionSw : data.nextActionEn;
  const lines = [
    `${t('rent', lang)} (${data.periodLabel})`,
    `${t('due', lang)}: ${data.amountDueDisplay}`,
    `${t('paid', lang)}: ${data.amountPaidDisplay}`,
    `${t('next', lang)}: ${next}`,
    `0. ${t('back', lang)}`,
  ];
  return truncateToUssd(lines.join('\n'));
}

export function buildNoRentScreen(lang: UssdLanguage): string {
  return truncateToUssd([t('noRent', lang), `0. ${t('back', lang)}`].join('\n'));
}

// ----------------------------------------------------------------------------
// Meter-reading flow
// ----------------------------------------------------------------------------

export function buildMeterReadingPrompt(lang: UssdLanguage): string {
  return truncateToUssd(t('enterUnits', lang));
}

export function buildMeterReadingConfirm(units: number, lang: UssdLanguage): string {
  const lines = [
    `${t('confirmReading', lang)} ${units}${t('units', lang)}?`,
    `1. ${t('yes', lang)}`,
    `2. ${t('no', lang)}`,
  ];
  return truncateToUssd(lines.join('\n'));
}

export function buildMeterReadingLoggedScreen(lang: UssdLanguage): string {
  return truncateToUssd(t('logged', lang));
}

// ----------------------------------------------------------------------------
// Maintenance screen
// ----------------------------------------------------------------------------

export function buildMaintenanceScreen(data: UssdMaintenanceData, lang: UssdLanguage): string {
  const statusLabel = lang === 'sw' ? data.statusSw : data.statusEn;
  const nextStep = lang === 'sw' ? data.nextStepSw : data.nextStepEn;
  const lines = [
    `${t('maintenance', lang)}`,
    `${t('reference', lang)}: ${data.reference}`,
    `${t('status', lang)}: ${statusLabel}`,
    `${t('summary', lang)}: ${data.summaryDisplay}`,
    `${t('next', lang)}: ${nextStep}`,
    `0. ${t('back', lang)}`,
  ];
  return truncateToUssd(lines.join('\n'));
}

export function buildNoMaintenanceScreen(lang: UssdLanguage): string {
  return truncateToUssd([t('noMaintenance', lang), `0. ${t('back', lang)}`].join('\n'));
}

// ----------------------------------------------------------------------------
// Marketplace screen (vacant-unit listings)
// ----------------------------------------------------------------------------

export function buildMarketplaceScreen(
  lines: readonly UssdMarketplaceLine[],
  lang: UssdLanguage,
): string {
  if (lines.length === 0) {
    return truncateToUssd([t('noMarket', lang), `0. ${t('back', lang)}`].join('\n'));
  }
  const header = t('selectUnit', lang);
  const items = lines.map((l, i) => {
    const unit = lang === 'sw' ? l.unitSw : l.unitEn;
    return `${i + 1}. ${unit} ${l.priceDisplay}`;
  });
  return truncateToUssd([header, ...items, `0. ${t('back', lang)}`].join('\n'));
}

// ----------------------------------------------------------------------------
// Language picker (the one allowed bilingual screen)
// ----------------------------------------------------------------------------

export function buildLanguageMenu(): string {
  return truncateToUssd(['Lugha / Language:', '1. English', '2. Kiswahili'].join('\n'));
}

export function buildLanguageSetScreen(lang: UssdLanguage): string {
  return truncateToUssd(t('langSet', lang));
}

// ----------------------------------------------------------------------------
// Error screens
// ----------------------------------------------------------------------------

export type UssdErrorCode = 'general' | 'invalid' | 'timeout' | 'not_linked';

const ERROR_MAP: Readonly<Record<UssdErrorCode, LabelKey>> = {
  general: 'errGeneral',
  invalid: 'errInvalid',
  timeout: 'errTimeout',
  not_linked: 'errNotLinked',
};

export function buildErrorScreen(code: UssdErrorCode, lang: UssdLanguage): string {
  return truncateToUssd(t(ERROR_MAP[code] ?? 'errGeneral', lang));
}
