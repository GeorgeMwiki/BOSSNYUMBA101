/**
 * BossNyumba DNA — React Native primitives for staff-mobile.
 *
 * These mirror the BossNyumba web design system (rounded-3xl cards,
 * gold-on-navy palette, Syne/Inter type ramp, pill buttons, gold-top
 * AI bubbles) so the BossNyumba Expo app reads visually identical to the
 * BossNyumba tenant portal.
 *
 * Import via:  `import { BnCard, tokens } from '@/ui'`
 * Or the relative path the existing codebase uses (no path alias here).
 */
export { tokens, type BnTokens } from './tokens'
export { greet, dayPart, type Daypart } from './greet'
export { BnCard, type BnCardProps, type BnCardTone } from './BnCard'
export {
  BnButton,
  type BnButtonProps,
  type BnButtonSize,
  type BnButtonVariant
} from './BnButton'
export { BnBadge, type BnBadgeProps, type BnBadgeTone } from './BnBadge'
export { BnAvatar, type BnAvatarProps } from './BnAvatar'
export { BnEmptyState, type BnEmptyStateProps } from './BnEmptyState'
export { BnChatBubble, type BnChatBubbleProps, type BnChatBubbleRole } from './BnChatBubble'
export { BnPageHero, type BnPageHeroProps } from './BnPageHero'
export { BnKpiTile, type BnKpiTileProps, type BnKpiTone } from './BnKpiTile'
export { BnThinkingDots } from './BnThinkingDots'
export {
  BnSkeleton,
  BnSkeletonStack,
  type BnSkeletonProps,
  type BnSkeletonStackProps
} from './BnSkeleton'
export { BnField, type BnFieldProps } from './BnField'
export { BnFormRow, type BnFormRowProps } from './BnFormRow'
export {
  BnSegmented,
  type BnSegmentedProps,
  type BnSegmentedOption
} from './BnSegmented'
export { BnBottomSheet, type BnBottomSheetProps } from './BnBottomSheet'
export { BnDrawer, type BnDrawerProps } from './BnDrawer'
export { BnToast, type BnToastProps, type BnToastTone } from './BnToast'
export { BnSplash, type BnSplashProps } from './BnSplash'
export { BnErrorState, type BnErrorStateProps } from './BnErrorState'
export { BnOfflineBanner, type BnOfflineBannerProps } from './BnOfflineBanner'
