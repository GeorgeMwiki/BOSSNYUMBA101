'use client';

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function setInstallPrompt(event: BeforeInstallPromptEvent): void {
  deferredPrompt = event;
}

export function clearInstallPrompt(): void {
  deferredPrompt = null;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    clearInstallPrompt();
    return true;
  }
  return false;
}

export function isInstallable(): boolean {
  return deferredPrompt !== null;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function onInstallPrompt(callback: (event: BeforeInstallPromptEvent) => void): () => void {
  const handler = (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    callback(e as BeforeInstallPromptEvent);
  };
  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}

export function onAppInstalled(callback: () => void): () => void {
  window.addEventListener('appinstalled', callback);
  return () => window.removeEventListener('appinstalled', callback);
}
