import sw from './sw.json'
import en from './en.json'
import type { Lang } from '../auth/types'

const STRINGS = { sw, en } as const

export type StringDict = typeof sw

export function pickStrings(lang: Lang): StringDict {
  // English-default (CLAUDE.md): an unexpected/unrecognized locale degrades to
  // English, never Swahili. screenStrings() inherits this via pickStrings().
  return STRINGS[lang] ?? STRINGS.en
}

export interface ScreenStrings {
  title: string
  intent: string
}

export function screenStrings(lang: Lang, id: string): ScreenStrings {
  const dict = pickStrings(lang)
  const entry = dict.screens[id as keyof typeof dict.screens] as ScreenStrings | undefined
  if (entry) {
    return entry
  }
  return { title: id, intent: '' }
}
