import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { AskBossNyumba } from '../../src/components/AskBossNyumba'
import { PlaceholderList } from '../../src/components/PlaceholderList'
import { RoleGuard } from '../../src/components/RoleGuard'

const SCREEN_ID = 'O-M-22'

export default function Screen(): JSX.Element {
  return (
    <RoleGuard screenId={SCREEN_ID}>
      <ScreenShell screenId={SCREEN_ID}>
        <Section title="Mahojiano ya BossNyumba">
          <AskBossNyumba label="Anza mahojiano" />
        </Section>
        <Section title="Hatua">
          <PlaceholderList
            items={[
              { id: 's1', primary: '1. Jina la kampuni' },
              { id: 's2', primary: '2. Hati za umiliki' },
              { id: 's3', primary: '3. Majengo na timu' }
            ]}
          />
        </Section>
      </ScreenShell>
    </RoleGuard>
  )
}
