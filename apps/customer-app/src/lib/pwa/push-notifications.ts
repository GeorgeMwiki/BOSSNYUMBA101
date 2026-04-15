'use client';

const PERMISSION_GRANTED = 'granted';
const PERMISSION_DENIED = 'denied';
const PERMISSION_DEFAULT = 'default';

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export async function getPushPermission(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const perm = Notification.permission;
  if (perm === PERMISSION_GRANTED) return 'granted';
  if (perm === PERMISSION_DENIED) return 'denied';
  return 'default';
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  if (result === PERMISSION_GRANTED) return 'granted';
  if (result === PERMISSION_DENIED) return 'denied';
  return 'default';
}

export class PushNotificationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'PushNotificationError';
  }
}

export async function getPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !navigator.serviceWorker.ready
  ) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const pushManager = registration.pushManager;
    if (!pushManager) return null;

    const subscription = await pushManager.getSubscription();
    return subscription?.toJSON() ?? null;
  } catch (error) {
    throw new PushNotificationError('Failed to read push subscription', error);
  }
}

export async function subscribeToPush(
  applicationServerKey?: string | ArrayBuffer
): Promise<PushSubscriptionJSON | null> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !navigator.serviceWorker.ready
  ) {
    return null;
  }

  const permission = await requestPushPermission();
  if (permission !== 'granted') return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const pushManager = registration.pushManager;
    if (!pushManager) return null;

    const options: PushSubscriptionOptionsInit = {
      userVisibleOnly: true,
      ...(applicationServerKey && { applicationServerKey }),
    };

    const subscription = await pushManager.subscribe(options);
    return subscription.toJSON();
  } catch (error) {
    throw new PushNotificationError('Failed to subscribe to push notifications', error);
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !navigator.serviceWorker.ready
  ) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const pushManager = registration.pushManager;
    if (!pushManager) return false;

    const sub = await pushManager.getSubscription();
    if (!sub) return false;
    return sub.unsubscribe();
  } catch (error) {
    throw new PushNotificationError('Failed to unsubscribe from push notifications', error);
  }
}
