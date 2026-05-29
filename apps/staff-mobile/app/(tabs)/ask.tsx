import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { AskBossNyumba } from '../../src/components/AskBossNyumba'
import { useAuth } from '../../src/auth/useAuth'

export default function AskTab(): JSX.Element {
  const { user } = useAuth()
  const screenId = user?.role === 'owner' ? 'O-M-02' : 'W-M-16'
  return (
    <ScreenShell screenId={screenId}>
      <Section title="Bonyeza ujumbe">
        <AskBossNyumba />
      </Section>
    </ScreenShell>
  )
}
