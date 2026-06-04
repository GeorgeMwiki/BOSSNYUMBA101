import { StyleSheet, Text, View } from 'react-native'
import { tokens } from '@/ui'

export interface MessageBubbleProps {
  readonly from: 'tenant' | 'landlord'
  readonly body: string
  readonly authorLabel: string
}

/**
 * Tenant-landlord message bubble — BossNyumba design DNA. The tenant
 * side (right-aligned) uses the warm-gold fill on navy text; the
 * counterparty (left-aligned) uses the navy AI bubble with a soft gold
 * top accent.
 */
export function MessageBubble({ from, body, authorLabel }: MessageBubbleProps) {
  const isTenant = from === 'tenant'
  return (
    <View style={[styles.bubble, isTenant ? styles.bubbleTenant : styles.bubbleLandlord]}>
      <Text style={[styles.author, { color: isTenant ? tokens.color.userBubbleText : tokens.color.accent }]}>
        {authorLabel}
      </Text>
      <Text style={[styles.body, { color: isTenant ? tokens.color.userBubbleText : tokens.color.textPrimary }]}>
        {body}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.lg,
    marginBottom: tokens.space.sm,
    borderWidth: 1,
    maxWidth: '88%'
  },
  bubbleTenant: {
    backgroundColor: tokens.color.userBubbleBg,
    borderColor: tokens.color.accentDeep,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6
  },
  bubbleLandlord: {
    backgroundColor: tokens.color.aiBubbleBg,
    borderColor: tokens.color.aiBubbleBorder,
    borderTopWidth: 2,
    borderTopColor: tokens.color.aiBubbleTopAccent,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6
  },
  author: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4
  },
  body: { fontSize: 15, lineHeight: 22 }
})
