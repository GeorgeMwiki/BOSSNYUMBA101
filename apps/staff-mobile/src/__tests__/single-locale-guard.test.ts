import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * Wave-D live detectors — absolute language-toggle + no-fabrication.
 *
 * staff-mobile vitest is Node-only with no React Native renderer, so these
 * are SOURCE detectors: they read the post-fix source of each touched
 * surface and assert the stacked sw/en render patterns are gone and that the
 * worker-shift hook no longer fabricates a working shift. They fail loudly if
 * a future edit reintroduces a stacked-locale string or a fake-shift fixture.
 */

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')

function source(relPath: string): string {
  return readFileSync(resolve(repoRoot, relPath), 'utf8')
}

describe('useI18n — English default', () => {
  it('defaults the unauthenticated/null locale to en, never sw', () => {
    const src = source('src/i18n/useI18n.ts')
    expect(src).toContain("user?.preferredLang ?? 'en'")
    expect(src).not.toContain("user?.preferredLang ?? 'sw'")
  })
})

describe('PreviewBanner — single locale', () => {
  it('renders one resolved message, not both sw and sub-en lines', () => {
    const src = source('src/components/PreviewBanner.tsx')
    // The old implementation rendered copy.sw in a label AND copy.en in a sub.
    expect(src).not.toContain('{copy.sw}')
    expect(src).not.toContain('{copy.en}')
    expect(src).not.toContain('`${copy.sw} — ${copy.en}`')
    expect(src).toContain('const message = bannerCopy(kind, lang)')
  })
})

describe('TodayTasks — single locale', () => {
  it('has no stacked "sw / en" chip, action, parallel, or loading strings', () => {
    const src = source('src/home/employee/TodayTasks.tsx')
    expect(src).not.toContain('{chip.sw} / {chip.en}')
    expect(src).not.toContain('Imekamilika / Done')
    expect(src).not.toContain('Shida / Blocked')
    expect(src).not.toContain('Sambamba / Parallel')
    expect(src).not.toContain("Inapakia kazi za leo… / Loading today's tasks…")
    // Each surfaced string resolves through the active locale.
    expect(src).toContain('TASK_COPY.done[lang]')
    expect(src).toContain('TASK_COPY.blocked[lang]')
    expect(src).toContain('TASK_COPY.loading[lang]')
  })
})

describe('O-M-09 lease calendar — single locale', () => {
  it('renders one renewal-success line and one renew label per locale', () => {
    const src = source('app/owner/O-M-09.tsx')
    expect(src).not.toContain(
      '`${t.licenceCalendar.renewSuccessSw}. ${t.licenceCalendar.renewSuccessEn}.`'
    )
    expect(src).not.toContain('`${strings.renewAction} / ${strings.renewActionEn}`')
    // Toast + renew label both resolve to a single active-locale string.
    expect(src).toContain('t.licenceCalendar.renewSuccessSw : t.licenceCalendar.renewSuccessEn')
    expect(src).toContain("lang === 'sw' ? strings.renewAction : strings.renewActionEn")
    // The toast and renew button no longer stack a second locale line.
    expect(src).not.toContain('{t.licenceCalendar.renewSuccessEn}')
    expect(src).not.toContain('{strings.renewActionEn}')
  })
})

describe('owner cockpit hub — single locale', () => {
  it('has no hardcoded stacked "en / sw" strings on the surface', () => {
    const src = source('app/owner/cockpit/index.tsx')
    expect(src).not.toContain('Loading cockpit… / Inapakia…')
    expect(src).not.toContain('Cockpit failed to load / Cockpit imeshindwa kupakia')
    expect(src).not.toContain('Cockpit hub is owner-only / Cockpit ni kwa mmiliki tu')
    expect(src).not.toContain('No pending decisions / Hakuna maamuzi yaliyosubiri')
    expect(src).not.toContain('{data.brief.headlineEn}')
    expect(src).not.toContain('{data.brief.headlineSw}')
    expect(src).toContain("const { lang } = useI18n()")
    expect(src).toContain("copy('loading', lang)")
  })
})

describe('useTodayShift — no fabrication', () => {
  it('does not invent a 06:00–18:00 shift; returns an honest empty state', () => {
    const src = source('src/home/worker/useTodayShift.ts')
    // No fabricated time window, no composed fake shift.
    expect(src).not.toContain('T06:00:00+03:00')
    expect(src).not.toContain('T18:00:00+03:00')
    expect(src).not.toContain('composeOfflineFallback')
    // Honest empty state: null on unavailable, and the return type allows it.
    expect(src).toContain('TodayShift | null')
    expect(src).toContain('return null')
  })
})
