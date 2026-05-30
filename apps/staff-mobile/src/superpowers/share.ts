/**
 * Superpower 4 — share (staff persona).
 *
 * Staff persona shares photo evidence / inspection PDFs. Server
 * mints a share link; we then open the native share-sheet.
 */
import { Share, type ShareContent } from 'react-native'
import * as Linking from 'expo-linking'
import { miningApi } from '../api/client'

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
}

interface ShareLinkApiResponse {
  readonly success: boolean
  readonly data?: { readonly url: string }
}

const FALLBACK_HOST = 'https://bossnyumba.app/staff'

function buildFallbackLink(req: ShareEntityRequest): string {
  return `${FALLBACK_HOST}/${encodeURIComponent(req.entityType)}/${encodeURIComponent(req.entityId)}`
}

export async function shareEntity(req: ShareEntityRequest): Promise<ShareResult> {
  let url = buildFallbackLink(req)
  try {
    const res = await miningApi.post<ShareLinkApiResponse>('/superpowers/share-links', {
      entityType: req.entityType,
      entityId: req.entityId,
      persona: 'staff',
      permission: 'read',
      expiresInHours: 168
    })
    if (res?.success && res.data?.url) {
      url = res.data.url
    }
  } catch {
    // ignore — fallback link still works
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
      return { ok: false, url, error: cause instanceof Error ? cause.message : 'share failed' }
    }
  }
}
