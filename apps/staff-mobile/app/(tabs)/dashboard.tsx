import { View } from 'react-native'
import { RoleGuard } from '../../src/components/RoleGuard'
import { ScreenShell } from '../../src/components/ScreenShell'
import { useAuth } from '../../src/auth/useAuth'
import { useI18n } from '../../src/i18n/useI18n'
import { EmployeeDashboard } from '../../src/dashboard/EmployeeDashboard'
import { ManagerDashboard } from '../../src/dashboard/ManagerDashboard'
import { OwnerDashboard } from '../../src/dashboard/OwnerDashboard'
import {
  BnPageHero,
  BnButton,
  greet,
  tokens
} from '../../src/ui'

const SCREEN_ID = 'dashboard'

/**
 * Dashboard tab — Dashibodi (Swahili) / Dashboard (English).
 *
 * BossNyumba-styled — opens with the borrower-dashboard hero rhythm
 * (eyebrow + display title + warm bilingual greeting + CTAs), then
 * routes into the role-aware composed status surface. The Home tab
 * remains chat-first.
 */
export default function DashboardTab(): JSX.Element {
  const { user } = useAuth()
  const { lang } = useI18n()
  const role = user?.role ?? 'employee'
  const firstName = (user?.fullName ?? '').split(' ')[0] ?? null
  const eyebrow = lang === 'sw' ? 'Dashibodi · BossNyumba' : 'Operator dashboard'
  const subtitle = role === 'owner'
    ? lang === 'sw'
      ? 'Hali ya mali yako kwa mtazamo mmoja: pesa, ukaaji, mikataba, na maamuzi.'
      : 'Your portfolio at a glance — cash, occupancy, leases, and decisions.'
    : role === 'manager'
      ? lang === 'sw'
        ? 'Hali ya tovuti: timu, matukio na vifaa kwa wakati halisi.'
        : 'Live site pulse: crew, incidents, equipment — in real time.'
      : lang === 'sw'
        ? 'Zamu yako leo: kazi, usalama na hatua inayofuata.'
        : 'Your shift today: tasks, safety, and the next step.'
  const primaryCtaLabel = lang === 'sw' ? 'Uliza BossNyumba' : 'Ask BossNyumba'
  const secondaryCtaLabel = lang === 'sw' ? 'Ona ratiba' : 'View schedule'

  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <BnPageHero
          eyebrow={eyebrow}
          title={greet(lang, firstName)}
          subtitle={subtitle}
          actions={
            <>
              <BnButton
                label={primaryCtaLabel}
                onPress={() => undefined}
                variant="primary"
                size="md"
                leadingIcon="*"
              />
              <BnButton
                label={secondaryCtaLabel}
                onPress={() => undefined}
                variant="secondary"
                size="md"
              />
            </>
          }
        />
        <View style={{ paddingTop: tokens.space.md }}>
          {role === 'owner' ? <OwnerDashboard /> : null}
          {role === 'manager' ? <ManagerDashboard /> : null}
          {role === 'employee' ? <EmployeeDashboard /> : null}
        </View>
      </ScreenShell>
    </RoleGuard>
  )
}
