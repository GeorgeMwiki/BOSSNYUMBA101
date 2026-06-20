/**
 * Push-token kind classifier.
 *
 * The canonical `/api/v1/me/device-tokens` surface (migration 0330) stores a
 * single opaque `token` column that may hold EITHER an Expo push token
 * (`ExponentPushToken[...]` / `ExpoPushToken[...]`) OR a raw FCM/APNS token.
 * These rails are NOT interchangeable: an Expo token handed to FCM's
 * `admin.messaging().send()` is rejected, and a raw FCM token is meaningless
 * to the Expo Push API. The push enqueuer + the two push providers route on
 * this classification so each token reaches the correct rail.
 *
 * Expo tokens are wrapped in a recognisable envelope, so detection is exact:
 *   ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *   ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *
 * Everything else is treated as a raw FCM/APNS token routed via Firebase.
 */

export type PushTokenKind = 'expo' | 'fcm';

const EXPO_TOKEN_RE = /^Expo(?:nent)?PushToken\[[^\]]+\]$/;

/**
 * True when `token` is an Expo push token (`ExponentPushToken[...]` or
 * `ExpoPushToken[...]`). Trimmed before matching so trailing whitespace from a
 * client payload never misclassifies an Expo token as a raw FCM token.
 */
export function isExpoPushToken(token: string): boolean {
  return EXPO_TOKEN_RE.test(token.trim());
}

/** Classify a raw device token into the rail that can deliver it. */
export function classifyPushToken(token: string): PushTokenKind {
  return isExpoPushToken(token) ? 'expo' : 'fcm';
}
