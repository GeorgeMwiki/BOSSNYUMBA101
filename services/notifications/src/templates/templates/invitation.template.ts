/**
 * Invitation template - invitation
 * Sent when an owner invites someone (by email) to join their tenant
 * but the invitee does not yet have a BOSSNYUMBA account.
 */

import type { SupportedLocale } from '../../types/index.js';
import { renderTemplate } from '../renderer.js';

export interface InvitationTemplateData {
  inviterName?: string;
  tenantName?: string;
  inviteToken: string;
  acceptUrl?: string;
}

const templates: Record<SupportedLocale, { subject: string; body: string; smsBody: string }> = {
  en: {
    subject: "You're invited to join {{tenantName}} on BOSSNYUMBA",
    body:
      '{{inviter}} invited you to join {{tenantName}} on BOSSNYUMBA. ' +
      'Create your account with this email and your invitation will activate automatically. ' +
      'Invite reference: {{inviteToken}}.{{acceptLine}}',
    smsBody:
      'You have been invited to join {{tenantName}} on BOSSNYUMBA. Sign up to accept. Ref: {{inviteToken}}',
  },
  sw: {
    subject: 'Umealikwa kujiunga na {{tenantName}} kwenye BOSSNYUMBA',
    body:
      '{{inviter}} amekualika ujiunge na {{tenantName}} kwenye BOSSNYUMBA. ' +
      'Fungua akaunti kwa barua pepe hii na mwaliko wako utaamilishwa moja kwa moja. ' +
      'Kumbukumbu ya mwaliko: {{inviteToken}}.{{acceptLine}}',
    smsBody:
      'Umealikwa kujiunga na {{tenantName}} kwenye BOSSNYUMBA. Jisajili kukubali. Kumb: {{inviteToken}}',
  },
};

export function getInvitationTemplate(
  locale: SupportedLocale,
  data: InvitationTemplateData
): { subject: string; body: string; smsBody: string } {
  const t = templates[locale] ?? templates.en;
  const vars: Record<string, string> = {
    inviter: data.inviterName ?? 'A BOSSNYUMBA admin',
    tenantName: data.tenantName ?? 'the workspace',
    inviteToken: data.inviteToken,
    acceptLine: data.acceptUrl ? ` Accept here: ${data.acceptUrl}` : '',
  };
  return {
    subject: renderTemplate(t.subject, vars),
    body: renderTemplate(t.body, vars),
    smsBody: renderTemplate(t.smsBody, vars),
  };
}
