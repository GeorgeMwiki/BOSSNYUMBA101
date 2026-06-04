import type { LanguageCode } from '@/types/auth'

// Renter persona greeting. Bilingual sw/en — Swahili is the default per
// project hard rule. Chips offer high-intent renter queries that map
// cleanly onto the tool registry (marketplace.recommended, market data,
// applications.active).

export interface ChatSuggestion {
  readonly id: string
  readonly prompt: string
  readonly label: string
}

// Marketplace Director persona introduction — paired with the time-
// aware greeting so the renter always knows who is speaking. The brain
// resolves the persona on every turn but the on-screen greeting hard-
// codes the role so the first impression is consistent.
const GREETINGS: Readonly<Record<LanguageCode, string>> = {
  sw:
    "Mimi ni Bw. Mwikila, Mkurugenzi wako wa Soko la BossNyumba. " +
    "Nakusaidia kupata nyumba, kuwasilisha maombi, na kuthibitisha " +
    "leseni za mwenye nyumba. Niambie unatafuta nini leo.",
  en:
    "I am Mr. Mwikila, your BossNyumba Marketplace Director. " +
    "I help renters find units, submit applications, and verify " +
    "landlord credentials. Tell me what you are looking for today."
}

const SUGGESTIONS_SW: readonly ChatSuggestion[] = [
  { id: 'units-live', prompt: 'Nyumba zinazopatikana sasa', label: 'Nyumba zinazopatikana sasa' },
  { id: 'rent-today', prompt: 'Bei ya kodi leo', label: 'Bei ya kodi leo' },
  { id: 'pending-applications', prompt: 'Maombi yangu yanayosubiri', label: 'Maombi yangu yanayosubiri' }
]

const SUGGESTIONS_EN: readonly ChatSuggestion[] = [
  { id: 'units-live', prompt: 'Units available now', label: 'Units available now' },
  { id: 'rent-today', prompt: 'Rent prices today', label: 'Rent prices today' },
  { id: 'pending-applications', prompt: 'My pending applications', label: 'My pending applications' }
]

export function buyerGreeting(lang: LanguageCode): string {
  return GREETINGS[lang] ?? GREETINGS.sw
}

export function buyerSuggestions(lang: LanguageCode): readonly ChatSuggestion[] {
  return lang === 'en' ? SUGGESTIONS_EN : SUGGESTIONS_SW
}

const LOADING_LABELS: Readonly<Record<LanguageCode, string>> = {
  sw: 'BossNyumba anafikiri…',
  en: 'BossNyumba is thinking…'
}

export function loadingLabel(lang: LanguageCode): string {
  return LOADING_LABELS[lang] ?? LOADING_LABELS.sw
}

const ERROR_LABELS: Readonly<Record<LanguageCode, string>> = {
  sw: 'Imeshindwa kuwasiliana na BossNyumba. Jaribu tena.',
  en: 'Could not reach BossNyumba. Please retry.'
}

export function errorLabel(lang: LanguageCode): string {
  return ERROR_LABELS[lang] ?? ERROR_LABELS.sw
}

const COMPOSER_PLACEHOLDER: Readonly<Record<LanguageCode, string>> = {
  sw: 'Andika ujumbe kwa BossNyumba...',
  en: 'Message BossNyumba...'
}

export function composerPlaceholder(lang: LanguageCode): string {
  return COMPOSER_PLACEHOLDER[lang] ?? COMPOSER_PLACEHOLDER.sw
}
