/**
 * useAutoDismissNotification — owner-portal
 *
 * Closes round-3 frontend audit finding **M-1**: every page that displays a
 * toast / inline notification used `setTimeout(() => setNotification(null),
 * 3000)` without tracking the handle. After unmount React 18 silently
 * swallows the warning but the timer still fires against a defunct fiber.
 *
 * Pattern:
 *
 *     const { notification, showNotification } = useAutoDismissNotification();
 *     showNotification({ type: 'success', message: 'Saved' });
 *     return notification ? <Toast {...notification} /> : null;
 *
 * The hook owns one timer handle. Calling `showNotification` again clears
 * the previous timer before queuing the new dismissal. Unmount fires the
 * cleanup which also clears it. No mutation: the notification object is
 * replaced each call.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Notification {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface UseAutoDismissNotificationOptions {
  /** Auto-dismiss delay in ms. Default 3000. */
  durationMs?: number;
}

export interface UseAutoDismissNotificationResult {
  notification: Notification | null;
  showNotification: (next: Notification) => void;
  clearNotification: () => void;
}

export function useAutoDismissNotification(
  options: UseAutoDismissNotificationOptions = {}
): UseAutoDismissNotificationResult {
  const durationMs = options.durationMs ?? 3000;
  const [notification, setNotification] = useState<Notification | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearNotification = useCallback(() => {
    clearTimer();
    setNotification(null);
  }, [clearTimer]);

  const showNotification = useCallback(
    (next: Notification) => {
      clearTimer();
      setNotification(next);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setNotification(null);
      }, durationMs);
    },
    [clearTimer, durationMs]
  );

  // Cleanup on unmount — also guards against React 18 strict-mode double-mount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return { notification, showNotification, clearNotification };
}
