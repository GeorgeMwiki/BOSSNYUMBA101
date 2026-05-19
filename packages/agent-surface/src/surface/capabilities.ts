/**
 * Capability tables per surface — the source of truth that drives
 * downgrade rules.
 *
 * SMS_MAX = 1000 chars (multi-part SMS supports more; we cap to keep
 * delivery sane).
 * WHATSAPP_MAX = 4096 (Meta API hard limit minus footer headroom).
 * EMAIL_MAX = 200_000 (HTML body).
 * WEB/MOBILE_MAX = 200_000 (LLM output cap).
 */

import type { SurfaceCapabilities, SurfaceKind } from './types.js';

export const SURFACE_CAPABILITIES: Readonly<Record<SurfaceKind, SurfaceCapabilities>> = {
  web: {
    richBlocks: true,
    markdown: true,
    attachments: true,
    htmlEmail: false,
    interactive: true,
    maxLengthChars: 200_000,
  },
  mobile: {
    richBlocks: true,
    markdown: true,
    attachments: true,
    htmlEmail: false,
    interactive: true,
    maxLengthChars: 200_000,
  },
  whatsapp: {
    richBlocks: false,
    markdown: true,
    attachments: true,
    htmlEmail: false,
    interactive: true,
    maxLengthChars: 4_096,
  },
  sms: {
    richBlocks: false,
    markdown: false,
    attachments: false,
    htmlEmail: false,
    interactive: true,
    maxLengthChars: 1_000,
  },
  email: {
    richBlocks: false,
    markdown: false,
    attachments: true,
    htmlEmail: true,
    interactive: false,
    maxLengthChars: 200_000,
  },
};
