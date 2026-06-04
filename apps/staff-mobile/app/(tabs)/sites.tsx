import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { ScreenShell } from '../../src/components/ScreenShell'
import { Section } from '../../src/components/Section'
import { PlaceholderList } from '../../src/components/PlaceholderList'
import { useAuth } from '../../src/auth/useAuth'
import { useI18n } from '../../src/i18n/useI18n'
import { colors } from '../../src/theme/colors'
import { fontSize, radius, spacing } from '../../src/theme/spacing'

export default function SitesTab(): JSX.Element {
  const { user } = useAuth()
  const { screen } = useI18n()
  const screenId = user?.role === 'owner' ? 'O-M-04' : 'W-M-19'

  return (
    <ScreenShell screenId={screenId}>
      <Section title="Mali yote">
        <PlaceholderList
          items={[
            { id: 'site-a', primary: 'Mali A · Geita', secondary: 'Hati TD-12345 · hai' },
            { id: 'site-b', primary: 'Mali B · Chunya', secondary: 'Hati TD-67890 · subiri' },
            { id: 'site-c', primary: 'Mali C · Mwanza', secondary: 'Hati TD-24680 · kazi' }
          ]}
        />
      </Section>
      <Section title="Skrini zinazohusiana">
        <View style={styles.grid}>
          {['O-M-05', 'O-M-06', 'W-M-02', 'W-M-19'].map((id) => (
            <Link key={id} href={hrefFor(id)} asChild>
              <Pressable style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}>
                <Text style={styles.chipCode}>{id}</Text>
                <Text style={styles.chipTitle} numberOfLines={2}>
                  {screen(id).title}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </Section>
    </ScreenShell>
  )
}

function hrefFor(id: string): string {
  return id.startsWith('O-M-') ? `/owner/${id}` : `/worker/${id}`
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    width: '48%',
    padding: spacing.lg,
    backgroundColor: colors.earth700,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  chipPressed: {
    backgroundColor: colors.earth500,
    transform: [{ scale: 0.98 }]
  },
  chipCode: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase'
  },
  chipTitle: {
    color: colors.text,
    fontSize: fontSize.body,
    marginTop: spacing.xs,
    fontWeight: '600'
  }
})
