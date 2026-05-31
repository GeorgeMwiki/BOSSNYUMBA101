/**
 * Superpower 4 — share (staff persona).
 *
 * Mints a real server-side share link via /api/v1/owner/share-links
 * (the canonical Wave SUPERPOWERS route, reused for the staff persona
 * via the SHARE_ENTITY_TYPES enum widening). NO hardcoded fallback
 * deep-link — backend errors surface to the caller.
 */
import { Share, type ShareContent } from 'react-native'
import * as Linking from 'expo-linking'
import { ownerApi } from '../api/client'

export interface ShareEntityRequest {
  readonly entityType: 'ticket' | 'inspection' | 'photo' | 'document'
  readonly entityId: string
  readonly title: string
}

export interface ShareResult {
  readonly ok: boolean
  readonly url?: string
  readonly cancelled?: boolean
  readonly error?: string
  readonly code?: string
}

interface ShareLinkApiResponse {
  readonly success: boolean
  readonly data?: { readonly url?: string; readonly token?: string }
  readonly error?: { readonly code?: string; readonly message?: string }
}

export async function shareEntity(req: ShareEntityRequest): Promise<ShareResult> {
  let url: string
  try {
    const res = await ownerApi.post<ShareLinkApiResponse>('/share-links', {
      entityType: req.entityType,
      entityId: req.entityId,
      permission: 'read',
      expiresInHours: 168,
      provenance: { persona: 'staff', surface: 'staff-mobile' }
    })
    if (!res?.success || !res.data?.url) {
      return {
        ok: false,
        error: res?.error?.message ?? 'Share link API returned no URL',
        code: res?.error?.code ?? 'SHARE_LINK_EMPTY'
      }
    }
    url = res.data.url
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : 'Share link request failed',
      code: 'SHARE_LINK_NETWORK'
    }
  }
  try {
    const content: ShareContent = { message: `${req.title}\n${url}`, url, title: req.title }
    const result = await Share.share(content)
    if (result.action === Share.dismissedAction) {
      return { ok: true, cancelled: true, url }
    }
    return { ok: true, url }
  } catch {
    try {
      await Linking.openURL(url)
      return { ok: true, url }
    } catch (cause) {
      return {
        ok: false,
        url,
        error: cause instanceof Error ? cause.message : 'share failed',
        code: 'SHARE_SHEET_FAILED'
      }
    }
  }
}
