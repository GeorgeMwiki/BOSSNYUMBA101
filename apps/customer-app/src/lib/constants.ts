/**
 * Application constants - from env only (no hardcoded fallbacks for production).
 * Set NEXT_PUBLIC_SUPPORT_* and NEXT_PUBLIC_EMERGENCY_* in .env.
 */

export const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '';
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '';
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '';

export function supportWhatsAppUrl(message: string): string {
  if (!SUPPORT_WHATSAPP) return '#';
  return `https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

/** Emergency contact entries from env (labels only hardcoded; numbers from env). */
export interface EmergencyContact {
  name: string;
  phone: string;
  available: string;
  type?: string;
}

export function getEmergencyContacts(): EmergencyContact[] {
  const primary = process.env.NEXT_PUBLIC_EMERGENCY_PRIMARY_PHONE ?? '';
  const maintenance = process.env.NEXT_PUBLIC_EMERGENCY_MAINTENANCE_PHONE ?? '';
  const security = process.env.NEXT_PUBLIC_EMERGENCY_SECURITY_PHONE ?? '';
  const list: EmergencyContact[] = [];
  if (primary)
    list.push({ name: 'Property Manager', phone: primary, available: '24/7', type: 'primary' });
  if (maintenance)
    list.push({ name: 'Maintenance Emergency', phone: maintenance, available: '8am–6pm', type: 'maintenance' });
  if (security)
    list.push({ name: 'Security', phone: security, available: '24/7', type: 'security' });
  list.push({ name: 'National Emergency', phone: '999', available: '24/7', type: 'police' });
  list.push({ name: 'Fire & Ambulance', phone: '999', available: '24/7', type: 'fire' });
  return list;
}
