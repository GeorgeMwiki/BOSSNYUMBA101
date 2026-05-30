/**
 * Superpower 4 — share (tenant persona).
 *
 * Tenant share target is typically a lease for co-tenant signature.
 * Server mints a share link; we then open the native share-sheet.
 * Backend lands via the parallel BN agent — until then the fallback
 * deep-link is enough to surface the entity in WhatsApp / email.
 */
import { Share, type ShareContent } from 'react-native'
import * as Linking from 'expo-linking'
import { apiFetch } from '@/api/client'

export interface ShareEntityRequest {
  readonly entityType: 'lease' | 'maintenance' | 'invoice' | 'document'
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

const FALLBACK_HOST = 'https://bossnyumba.app/tenant'

function buildFallbackLink(req: ShareEntityRequest): string {
  return `${FALLBACK_HOST}/${encodeURIComponent(req.entityType)}/${encodeURIComponent(req.entityId)}`
}

export async function shareEntity(req: ShareEntityRequest): Promise<ShareResult> {
  let url = buildFallbackLink(req)
  try {
    const res = await apiFetch<ShareLinkApiResponse>('/api/v1/tenant/superpowers/share-links', {
      method: 'POST',
      body: {
        entityType: req.entityType,
        entityId: req.entityId,
        persona: 'tenant',
        permission: req.entityType === 'lease' ? 'comment' : 'read',
        expiresInHours: 168
      }
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
