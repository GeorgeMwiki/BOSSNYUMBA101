/**
 * SuperpowerChips — Wave SUPERPOWERS frontend renderer (real-estate).
 *
 * Renders one chip per parsed superpower SSE event below the assistant
 * bubble. Eight families:
 *
 *   ui_navigate  -> "Open Maintenance (Westlands)"
 *   ui_prefill   -> "Apply these to the form"
 *   ui_highlight -> "Show me the tip"
 *   ui_share     -> "Generate share link"
 *   ui_bulk      -> "Apply to N items"
 *   ui_undo      -> "Undo (4:58)" / "Redo (4:58)"
 *   ui_cmdk      -> "Open command palette"
 *   ui_bookmark  -> "Pin to quick access"
 *
 * Click semantics:
 *   - navigate    -> publishes navigate event (parent app routes)
 *   - prefill     -> publishes formPrefillBus + dispatches event
 *   - highlight   -> publishes highlightBus
 *   - share       -> POSTs /api/v1/owner/share-links + copies URL
 *   - bulk        -> POSTs /api/v1/owner/superpowers/bulk-action
 *   - undo/redo   -> POSTs /api/v1/owner/undo-journal/undo-last or
 *                   /redo-last
 *   - cmdk        -> publishes openCommandPalette event
 *   - bookmark    -> POSTs /api/v1/owner/pinned-items
 *
 * Each successful WRITE chip surfaces an "Undo (4:58)" countdown chip
 * via UndoChip beneath the chip the owner just clicked.
 *
 * Ported from Borjie apps/owner-web/src/components/home-chat/
 * SuperpowerChips.tsx. Real-estate retailored: domain examples now
 * reference Maintenance / Lease / Rent. No web-app framework
 * dependency — routing is delegated to an injected `onNavigate`
 * callback so the same component renders in Next.js owner-web,
 * Vite owner-portal, or React-Native Expo apps via a thin shim.
 */

import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

// ─── Schemas (mirrors services/api-gateway/src/routes/ui-navigate-parser.ts) ─

const bilingual = z
  .object({ en: z.string().min(1), sw: z.string().min(1) })
  .strict();

export const uiNavigateChipSchema = z
  .object({
    route: z.string().regex(/^\//),
    scopeIds: z.array(z.string()).optional(),
    focus: z.string().optional(),
    ttl: z.number().int().optional(),
    reason: z.string().min(1),
  })
  .strict();
export type UiNavigateChip = z.infer<typeof uiNavigateChipSchema>;

export const uiPrefillChipSchema = z
  .object({
    formId: z.string().min(1),
    values: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    ),
    submitOnAccept: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .strict();
export type UiPrefillChip = z.infer<typeof uiPrefillChipSchema>;

export const uiHighlightChipSchema = z
  .object({
    selector: z.string().min(1),
    message: bilingual,
    ttl: z.number().int().optional(),
    tone: z.enum(['info', 'success', 'warning', 'critical']).optional(),
  })
  .strict();
export type UiHighlightChip = z.infer<typeof uiHighlightChipSchema>;

export const uiShareChipSchema = z
  .object({
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    recipients: z.array(z.string().email()).optional(),
    expiresInHours: z.number().int(),
    permission: z.enum(['read', 'comment', 'edit']),
    reason: z.string().optional(),
  })
  .strict();
export type UiShareChip = z.infer<typeof uiShareChipSchema>;

export const uiBulkChipSchema = z
  .object({
    entityType: z.string().min(1),
    ids: z.array(z.string()).min(1),
    action: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).optional(),
    reason: z.string().min(1),
  })
  .strict();
export type UiBulkChip = z.infer<typeof uiBulkChipSchema>;

export const uiUndoChipSchema = z
  .object({
    direction: z.enum(['undo', 'redo']),
    description: bilingual.optional(),
    windowSeconds: z.number().int().optional(),
    reason: z.string().optional(),
  })
  .strict();
export type UiUndoChip = z.infer<typeof uiUndoChipSchema>;

export const uiCmdkChipSchema = z
  .object({
    intent: z.string().min(1),
    scopeIds: z.array(z.string()).optional(),
    presetRecents: z.array(z.string()).optional(),
    reason: z.string().optional(),
  })
  .strict();
export type UiCmdkChip = z.infer<typeof uiCmdkChipSchema>;

export const uiBookmarkChipSchema = z
  .object({
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    label: z.string().optional(),
    folder: z.string().optional(),
    tags: z.array(z.string()).optional(),
    reason: z.string().optional(),
  })
  .strict();
export type UiBookmarkChip = z.infer<typeof uiBookmarkChipSchema>;

// ─── Cross-component bus events ──────────────────────────────────────

type FormPrefillEvent = {
  formId: string;
  values: Record<string, unknown>;
  submitOnAccept: boolean;
};
type HighlightEvent = {
  selector: string;
  message: { en: string; sw: string };
  ttl: number;
  tone: 'info' | 'success' | 'warning' | 'critical';
};
type CmdkEvent = {
  intent: string;
  scopeIds?: ReadonlyArray<string>;
  presetRecents?: ReadonlyArray<string>;
};

export const FORM_PREFILL_EVENT_NAME = 'bossnyumba:form-prefill';
export const HIGHLIGHT_EVENT_NAME = 'bossnyumba:highlight';
export const CMDK_OPEN_EVENT_NAME = 'bossnyumba:cmdk-open';

export function publishFormPrefill(payload: FormPrefillEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(FORM_PREFILL_EVENT_NAME, { detail: payload }),
  );
}

export function publishHighlight(payload: HighlightEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(HIGHLIGHT_EVENT_NAME, { detail: payload }),
  );
}

export function publishOpenCommandPalette(payload: CmdkEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CMDK_OPEN_EVENT_NAME, { detail: payload }),
  );
}

// ─── Undo chip ────────────────────────────────────────────────────────

export interface UndoChipProps {
  readonly languagePreference: 'sw' | 'en';
  readonly journalIds: ReadonlyArray<string>;
  readonly windowSeconds?: number;
  readonly direction?: 'undo' | 'redo';
  readonly onUndone?: () => void;
  readonly postJson?: (path: string, body: unknown) => Promise<unknown>;
}

function formatCountdown(secsLeft: number): string {
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function UndoChip({
  languagePreference,
  journalIds,
  windowSeconds = 300,
  direction = 'undo',
  onUndone,
  postJson,
}: UndoChipProps): ReactElement | null {
  const [secsLeft, setSecsLeft] = useState(windowSeconds);
  const [undone, setUndone] = useState(false);

  useEffect(() => {
    if (secsLeft <= 0 || undone) return undefined;
    const t = window.setTimeout(() => setSecsLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secsLeft, undone]);

  const onClick = useCallback(async () => {
    if (undone || secsLeft <= 0) return;
    if (postJson) {
      const path =
        direction === 'undo'
          ? '/api/v1/owner/undo-journal/undo-last'
          : '/api/v1/owner/undo-journal/redo-last';
      await postJson(path, {
        reason: `user-clicked-${direction}-chip`,
        journalIds,
      });
    }
    setUndone(true);
    onUndone?.();
  }, [undone, secsLeft, onUndone, postJson, direction, journalIds]);

  if (journalIds.length === 0) return null;
  if (undone) {
    return (
      <span
        className="inline-flex items-center gap-1 text-tiny text-success"
        data-testid={`superpower-${direction}-chip-done`}
      >
        {languagePreference === 'sw' ? 'Imefanyika' : 'Done'}
      </span>
    );
  }
  if (secsLeft <= 0) return null;
  const swLabel = direction === 'undo' ? 'Tendua' : 'Rudia';
  const enLabel = direction === 'undo' ? 'Undo' : 'Redo';
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="inline-flex items-center gap-1 rounded border border-border bg-surface/60 px-2 py-0.5 text-tiny text-neutral-300 hover:bg-surface"
      data-testid={`superpower-${direction}-chip`}
    >
      {languagePreference === 'sw' ? swLabel : enLabel} ({formatCountdown(secsLeft)})
    </button>
  );
}

// ─── Public renderer ──────────────────────────────────────────────────

export interface SuperpowerChipsProps {
  readonly languagePreference: 'sw' | 'en';
  readonly navigates: ReadonlyArray<UiNavigateChip>;
  readonly prefills: ReadonlyArray<UiPrefillChip>;
  readonly highlights: ReadonlyArray<UiHighlightChip>;
  readonly shares: ReadonlyArray<UiShareChip>;
  readonly bulks: ReadonlyArray<UiBulkChip>;
  readonly undos: ReadonlyArray<UiUndoChip>;
  readonly cmdks: ReadonlyArray<UiCmdkChip>;
  readonly bookmarks: ReadonlyArray<UiBookmarkChip>;
  /** Injected — host app routes via this callback. */
  readonly onNavigate: (chip: UiNavigateChip) => void;
  /** Injected JSON POST shim. Returns parsed `data` field on success. */
  readonly postJson?: <T = unknown>(
    path: string,
    body: unknown,
  ) => Promise<T | null>;
}

export function SuperpowerChips(
  props: SuperpowerChipsProps,
): ReactElement | null {
  const [activeUndoIds, setActiveUndoIds] = useState<ReadonlyArray<string>>([]);
  const [activeRedoIds, setActiveRedoIds] = useState<ReadonlyArray<string>>([]);
  const postJson = props.postJson;

  const onPrefill = useCallback(
    async (chip: UiPrefillChip) => {
      publishFormPrefill({
        formId: chip.formId,
        values: chip.values,
        submitOnAccept: chip.submitOnAccept ?? false,
      });
      if (postJson) {
        await postJson('/api/v1/owner/superpowers/prefill', chip);
      }
    },
    [postJson],
  );

  const onHighlight = useCallback((chip: UiHighlightChip) => {
    publishHighlight({
      selector: chip.selector,
      message: chip.message,
      ttl: chip.ttl ?? 8000,
      tone: chip.tone ?? 'info',
    });
  }, []);

  const onShare = useCallback(
    async (chip: UiShareChip) => {
      if (!postJson) return;
      const data = await postJson<{
        shareLinkId: string;
        url: string;
      }>('/api/v1/owner/share-links', chip);
      if (data?.url && typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(data.url);
      }
    },
    [postJson],
  );

  const onBulk = useCallback(
    async (chip: UiBulkChip) => {
      if (!postJson) return;
      const data = await postJson<{
        undoJournalIds: ReadonlyArray<string>;
        failedIds?: ReadonlyArray<string>;
      }>('/api/v1/owner/superpowers/bulk-action', chip);
      if (data?.undoJournalIds && data.undoJournalIds.length > 0) {
        setActiveUndoIds(data.undoJournalIds);
      }
    },
    [postJson],
  );

  const onUndo = useCallback(
    async (chip: UiUndoChip) => {
      if (chip.direction === 'undo') {
        setActiveUndoIds(['chat-emitted-undo']);
      } else {
        setActiveRedoIds(['chat-emitted-redo']);
      }
    },
    [],
  );

  const onCmdk = useCallback((chip: UiCmdkChip) => {
    publishOpenCommandPalette({
      intent: chip.intent,
      ...(chip.scopeIds && { scopeIds: chip.scopeIds }),
      ...(chip.presetRecents && { presetRecents: chip.presetRecents }),
    });
  }, []);

  const onBookmark = useCallback(
    async (chip: UiBookmarkChip) => {
      if (!postJson) return;
      const data = await postJson<{ pinnedItemId: string }>(
        '/api/v1/owner/pinned-items',
        chip,
      );
      if (data?.pinnedItemId) {
        setActiveUndoIds([data.pinnedItemId]);
      }
    },
    [postJson],
  );

  const total =
    props.navigates.length +
    props.prefills.length +
    props.highlights.length +
    props.shares.length +
    props.bulks.length +
    props.undos.length +
    props.cmdks.length +
    props.bookmarks.length;
  if (total === 0) return null;

  const sw = props.languagePreference === 'sw';

  return (
    <ul
      className="m-0 flex list-none flex-wrap gap-1.5 p-0 pl-10"
      data-testid="superpower-chip-row"
      role="list"
      aria-label={sw ? 'Mapendekezo ya Mr. Mwikila' : "Mr. Mwikila's suggestions"}
    >
      {props.navigates.map((chip, i) => (
        <li key={`nav_${i}`}>
          <button
            type="button"
            onClick={() => props.onNavigate(chip)}
            className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/5 px-2.5 py-1 text-xs text-warning hover:bg-warning/10"
            data-testid="superpower-chip-navigate"
            title={chip.reason}
          >
            {sw ? 'Fungua' : 'Open'} {chip.route}
            {chip.focus ? ` (${chip.focus})` : ''}
          </button>
        </li>
      ))}
      {props.prefills.map((chip, i) => (
        <li key={`pf_${i}`}>
          <button
            type="button"
            onClick={() => void onPrefill(chip)}
            className="inline-flex items-center gap-1 rounded border border-info/40 bg-info/5 px-2.5 py-1 text-xs text-info hover:bg-info/10"
            data-testid="superpower-chip-prefill"
            title={chip.reason ?? ''}
          >
            {sw ? 'Jaza fomu' : 'Pre-fill form'} ({chip.formId})
          </button>
        </li>
      ))}
      {props.highlights.map((chip, i) => (
        <li key={`hl_${i}`}>
          <button
            type="button"
            onClick={() => onHighlight(chip)}
            className="inline-flex items-center gap-1 rounded border border-border bg-surface/60 px-2.5 py-1 text-xs text-neutral-300 hover:bg-surface"
            data-testid="superpower-chip-highlight"
          >
            {sw ? 'Onyesha kidokezo' : 'Show me'}
          </button>
        </li>
      ))}
      {props.shares.map((chip, i) => (
        <li key={`sh_${i}`}>
          <button
            type="button"
            onClick={() => void onShare(chip)}
            className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/5 px-2.5 py-1 text-xs text-warning hover:bg-warning/10"
            data-testid="superpower-chip-share"
            title={chip.reason ?? ''}
          >
            {sw ? 'Tengeneza kiungo' : 'Generate share link'}
          </button>
        </li>
      ))}
      {props.bulks.map((chip, i) => (
        <li key={`bk_${i}`}>
          <button
            type="button"
            onClick={() => void onBulk(chip)}
            className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/5 px-2.5 py-1 text-xs text-warning hover:bg-warning/10"
            data-testid="superpower-chip-bulk"
            title={chip.reason}
          >
            {chip.action} {chip.ids.length} {sw ? 'vitu' : 'items'}
          </button>
        </li>
      ))}
      {props.undos.map((chip, i) => (
        <li key={`un_${i}`}>
          <button
            type="button"
            onClick={() => void onUndo(chip)}
            className="inline-flex items-center gap-1 rounded border border-neutral-300/40 bg-surface/60 px-2.5 py-1 text-xs text-neutral-300 hover:bg-surface"
            data-testid={`superpower-chip-${chip.direction}`}
            title={chip.reason ?? ''}
          >
            {chip.direction === 'undo'
              ? sw
                ? 'Tendua kitendo'
                : 'Undo last action'
              : sw
                ? 'Rudia kitendo'
                : 'Redo last action'}
          </button>
        </li>
      ))}
      {props.cmdks.map((chip, i) => (
        <li key={`cm_${i}`}>
          <button
            type="button"
            onClick={() => onCmdk(chip)}
            className="inline-flex items-center gap-1 rounded border border-info/40 bg-info/5 px-2.5 py-1 text-xs text-info hover:bg-info/10"
            data-testid="superpower-chip-cmdk"
            title={chip.reason ?? ''}
            aria-haspopup="dialog"
          >
            {sw ? 'Fungua amri' : 'Open command palette'} ({chip.intent})
          </button>
        </li>
      ))}
      {props.bookmarks.map((chip, i) => (
        <li key={`bm_${i}`}>
          <button
            type="button"
            onClick={() => void onBookmark(chip)}
            className="inline-flex items-center gap-1 rounded border border-success/40 bg-success/5 px-2.5 py-1 text-xs text-success hover:bg-success/10"
            data-testid="superpower-chip-bookmark"
            title={chip.reason ?? ''}
          >
            {sw ? 'Bandika' : 'Pin'}{' '}
            {chip.label ?? chip.entityId}
            {chip.folder ? ` / ${chip.folder}` : ''}
          </button>
        </li>
      ))}
      {activeUndoIds.length > 0 ? (
        <li>
          <UndoChip
            languagePreference={props.languagePreference}
            journalIds={activeUndoIds}
            direction="undo"
            {...(postJson && { postJson })}
            onUndone={() => setActiveUndoIds([])}
          />
        </li>
      ) : null}
      {activeRedoIds.length > 0 ? (
        <li>
          <UndoChip
            languagePreference={props.languagePreference}
            journalIds={activeRedoIds}
            direction="redo"
            {...(postJson && { postJson })}
            onUndone={() => setActiveRedoIds([])}
          />
        </li>
      ) : null}
    </ul>
  );
}
