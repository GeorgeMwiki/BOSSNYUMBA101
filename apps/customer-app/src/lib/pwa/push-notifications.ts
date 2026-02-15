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

export async function getPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !navigator.serviceWorker.ready
  ) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const pushManager = registration.pushManager;
  if (!pushManager) return null;

  const subscription = await pushManager.getSubscription();
  return subscription?.toJSON() ?? null;
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

  const registration = await navigator.serviceWorker.ready;
  const pushManager = registration.pushManager;
  if (!pushManager) return null;

  const options: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
    ...(applicationServerKey && { applicationServerKey }),
  };

  const subscription = await pushManager.subscribe(options);
  return subscription.toJSON();
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getPushSubscription();
  if (!subscription?.endpoint) return false;

  const registration = await navigator.serviceWorker.ready;
  const pushManager = registration.pushManager;
  if (!pushManager) return false;

  const sub = await pushManager.getSubscription();
  if (sub) {
    return sub.unsubscribe();
  }
  return false;
}
