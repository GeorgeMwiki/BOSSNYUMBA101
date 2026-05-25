/**
 * draft-storage — sessionStorage-backed draft persistence for chat
 * composers.
 *
 * EP-4 outsized-UX improvement: every textarea in the assistant
 * surfaces should remember what the user typed if they navigate
 * away. We use `sessionStorage` (not `localStorage`) so the draft
 * survives a refresh but evaporates when the tab closes — matches
 * the user's mental model of "this is a single conversation".
 *
 * SSR-safe: every call guards `typeof window` so the module can be
 * imported into a server component without throwing.
 */

const KEY_PREFIX = 'bossnyumba:draft:';

function key(threadId: string): string {
  return `${KEY_PREFIX}${threadId}`;
}

export function saveDraft(threadId: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (value.length === 0) {
      window.sessionStorage.removeItem(key(threadId));
    } else {
      window.sessionStorage.setItem(key(threadId), value);
    }
  } catch {
    // sessionStorage can throw in private mode or when quota is
    // exceeded. Silently ignore — drafts are nice-to-have, not
    // load-bearing.
  }
}

export function loadDraft(threadId: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(key(threadId)) ?? '';
  } catch {
    return '';
  }
}

export function clearDraft(threadId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key(threadId));
  } catch {
    // ignore — same reasons as saveDraft
  }
}

/**
 * Build a debounced saver bound to a single thread. Returns the
 * debounced fn plus a `cancel` cleanup. Use in React effects:
 *
 *     const { save, cancel } = createDraftSaver(threadId, 250);
 *     useEffect(() => () => cancel(), [cancel]);
 */
export function createDraftSaver(
  threadId: string,
  delayMs: number = 250,
): { save: (value: string) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = (value: string): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      saveDraft(threadId, value);
      timer = null;
    }, delayMs);
  };
  const cancel = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return { save, cancel };
}
