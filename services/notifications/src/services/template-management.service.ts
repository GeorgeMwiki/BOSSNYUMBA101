/**
 * Template Management Service
 * 
 * Manages notification templates for the BOSSNYUMBA platform.
 * Supports multi-locale templates, tenant customization, and versioning.
 */

import { v4 as uuidv4 } from 'uuid';
import type { TenantId, NotificationChannel, SupportedLocale } from '../types/index.js';
import { renderTemplate as renderWithVariables } from '../templates/renderer.js';
import { createLogger } from '../logger.js';

const logger = createLogger('template-management-service');

// ============================================================================
// Types
// ============================================================================

export type TemplateCategory = 
  | 'payment'
  | 'maintenance'
  | 'lease'
  | 'onboarding'
  | 'communication'
  | 'system'
  | 'marketing'
  | 'reminder';

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  example?: string;
}

export interface TemplateContent {
  locale: SupportedLocale;
  subject: string;
  body: string;
  smsBody?: string;
  whatsappBody?: string;
}

export interface NotificationTemplate {
  readonly id: string;
  readonly tenantId: TenantId | null; // null = system template
  readonly code: string; // Unique identifier for template
  readonly name: string;
  readonly description: string;
  readonly category: TemplateCategory;
  readonly channels: NotificationChannel[];
  readonly variables: TemplateVariable[];
  readonly content: TemplateContent[];
  readonly isActive: boolean;
  readonly isSystemTemplate: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly updatedBy: string;
}

export interface CreateTemplateInput {
  tenantId?: TenantId;
  code: string;
  name: string;
  description: string;
  category: TemplateCategory;
  channels: NotificationChannel[];
  variables: TemplateVariable[];
  content: TemplateContent[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  channels?: NotificationChannel[];
  variables?: TemplateVariable[];
  content?: TemplateContent[];
  isActive?: boolean;
}

export interface RenderTemplateInput {
  templateId?: string;
  templateCode?: string;
  tenantId: TenantId;
  locale: SupportedLocale;
  data: Record<string, string>;
  channel: NotificationChannel;
}

export interface RenderedTemplate {
  subject: string;
  body: string;
  smsBody: string;
  whatsappBody: string;
}

export interface TemplatePreview {
  subject: string;
  body: string;
  smsBody: string;
  whatsappBody: string;
  variables: Record<string, string>;
}

// ============================================================================
// In-Memory Storage (Replace with database in production)
// ============================================================================

const templates = new Map<string, NotificationTemplate>();
const templatesByCode = new Map<string, NotificationTemplate[]>(); // code -> [system, ...tenant templates]

// ============================================================================
// Default System Templates
// ============================================================================

const systemTemplates: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    tenantId: null,
    code: 'rent_due',
    name: 'Rent Due Reminder',
    description: 'Reminder sent before rent is due',
    category: 'payment',
    channels: ['sms', 'whatsapp', 'email', 'push'],
    variables: [
      { name: 'customerName', description: 'Customer full name', required: true },
      { name: 'amount', description: 'Rent amount due', required: true },
      { name: 'dueDate', description: 'Due date', required: true },
      { name: 'unitNumber', description: 'Unit number', required: false },
      { name: 'paymentLink', description: 'Link to make payment', required: false },
    ],
    content: [
      {
        locale: 'en',
        subject: 'Rent Due Reminder - {{dueDate}}',
        body: `Dear {{customerName}},

This is a friendly reminder that your rent payment of {{amount}} is due on {{dueDate}}.

Please ensure payment is made on time to avoid any late fees.

{{#if paymentLink}}
Pay now: {{paymentLink}}
{{/if}}

Thank you for being a valued tenant.

Best regards,
BOSSNYUMBA`,
        smsBody: 'Hi {{customerName}}, your rent of {{amount}} is due on {{dueDate}}. Please pay on time to avoid late fees.',
        whatsappBody: '👋 Hi {{customerName}}!\n\nYour rent payment of *{{amount}}* is due on *{{dueDate}}*.\n\n💳 Please ensure timely payment to avoid late fees.\n\nThank you! 🏠',
      },
      {
        locale: 'sw',
        subject: 'Ukumbusho wa Kodi - {{dueDate}}',
        body: `Mpendwa {{customerName}},

Hii ni ukumbusho kwamba malipo yako ya kodi ya {{amount}} yanatarajiwa tarehe {{dueDate}}.

Tafadhali hakikisha malipo yanafanywa kwa wakati ili kuepuka adhabu za kuchelewa.

Asante kwa kuwa mpangaji wetu.

Wasalaam,
BOSSNYUMBA`,
        smsBody: 'Habari {{customerName}}, kodi yako ya {{amount}} inatakiwa tarehe {{dueDate}}. Tafadhali lipa kwa wakati.',
        whatsappBody: '👋 Habari {{customerName}}!\n\nMalipo yako ya kodi ya *{{amount}}* yanatarajiwa tarehe *{{dueDate}}*.\n\n💳 Tafadhali lipa kwa wakati kuepuka adhabu.\n\nAsante! 🏠',
      },
    ],
    isActive: true,
    isSystemTemplate: true,
    version: 1,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    tenantId: null,
    code: 'rent_overdue',
    name: 'Rent Overdue Notice',
    description: 'Notice sent when rent is overdue',
    category: 'payment',
    channels: ['sms', 'whatsapp', 'email', 'push'],
    variables: [
      { name: 'customerName', description: 'Customer full name', required: true },
      { name: 'amount', description: 'Amount overdue', required: true },
      { name: 'daysOverdue', description: 'Number of days overdue', required: true },
      { name: 'lateFee', description: 'Late fee amount', required: false },
      { name: 'paymentLink', description: 'Link to make payment', required: false },
    ],
    content: [
      {
        locale: 'en',
        subject: 'Urgent: Rent Payment Overdue',
        body: `Dear {{customerName}},

Your rent payment of {{amount}} is now {{daysOverdue}} days overdue.

{{#if lateFee}}
A late fee of {{lateFee}} has been applied to your account.
{{/if}}

Please make payment immediately to avoid further action.

{{#if paymentLink}}
Pay now: {{paymentLink}}
{{/if}}

If you are experiencing difficulties, please contact us to discuss payment arrangements.

Best regards,
BOSSNYUMBA`,
        smsBody: 'URGENT: {{customerName}}, your rent of {{amount}} is {{daysOverdue}} days overdue. Please pay immediately to avoid further action.',
        whatsappBody: '⚠️ *Urgent Notice*\n\nHi {{customerName}},\n\nYour rent of *{{amount}}* is *{{daysOverdue}} days overdue*.\n\n{{#if lateFee}}Late fee: {{lateFee}}{{/if}}\n\n📞 Contact us if you need to discuss payment options.',
      },
      {
        locale: 'sw',
        subject: 'Haraka: Kodi Imechelewa',
        body: `Mpendwa {{customerName}},

Malipo yako ya kodi ya {{amount}} yamechelewa kwa siku {{daysOverdue}}.

{{#if lateFee}}
Adhabu ya kuchelewa ya {{lateFee}} imeongezwa kwenye akaunti yako.
{{/if}}

Tafadhali fanya malipo mara moja ili kuepuka hatua zaidi.

Wasalaam,
BOSSNYUMBA`,
        smsBody: 'HARAKA: {{customerName}}, kodi yako ya {{amount}} imechelewa siku {{daysOverdue}}. Tafadhali lipa mara moja.',
        whatsappBody: '⚠️ *Taarifa ya Haraka*\n\nHabari {{customerName}},\n\nKodi yako ya *{{amount}}* imechelewa *siku {{daysOverdue}}*.\n\n📞 Wasiliana nasi kwa mazungumzo.',
      },
    ],
    isActive: true,
    isSystemTemplate: true,
    version: 1,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    tenantId: null,
    code: 'payment_received',
    name: 'Payment Confirmation',
    description: 'Confirmation sent when payment is received',
    category: 'payment',
    channels: ['sms', 'whatsapp', 'email', 'push'],
    variables: [
      { name: 'customerName', description: 'Customer full name', required: true },
      { name: 'amount', description: 'Payment amount', required: true },
      { name: 'transactionId', description: 'Transaction reference', required: true },
      { name: 'paymentDate', description: 'Date of payment', required: true },
      { name: 'newBalance', description: 'New account balance', required: false },
    ],
    content: [
      {
        locale: 'en',
        subject: 'Payment Received - Thank You!',
        body: `Dear {{customerName}},

We have received your payment of {{amount}}.

Transaction Details:
- Reference: {{transactionId}}
- Date: {{paymentDate}}
{{#if newBalance}}
- New Balance: {{newBalance}}
{{/if}}

Thank you for your prompt payment!

Best regards,
BOSSNYUMBA`,
        smsBody: 'Payment of {{amount}} received. Ref: {{transactionId}}. Thank you, {{customerName}}!',
        whatsappBody: '✅ *Payment Received*\n\nHi {{customerName}},\n\nWe received your payment of *{{amount}}*.\n\n📝 Ref: {{transactionId}}\n📅 Date: {{paymentDate}}\n\nThank you! 🙏',
      },
      {
        locale: 'sw',
        subject: 'Malipo Yamepokelewa - Asante!',
        body: `Mpendwa {{customerName}},

Tumepokea malipo yako ya {{amount}}.

Maelezo:
- Kumbukumbu: {{transactionId}}
- Tarehe: {{paymentDate}}
{{#if newBalance}}
- Salio Jipya: {{newBalance}}
{{/if}}

Asante kwa malipo yako!

Wasalaam,
BOSSNYUMBA`,
        smsBody: 'Malipo ya {{amount}} yamepokelewa. Kumb: {{transactionId}}. Asante, {{customerName}}!',
        whatsappBody: '✅ *Malipo Yamepokelewa*\n\nHabari {{customerName}},\n\nTumepokea malipo yako ya *{{amount}}*.\n\n📝 Kumb: {{transactionId}}\n📅 Tarehe: {{paymentDate}}\n\nAsante! 🙏',
      },
    ],
    isActive: true,
    isSystemTemplate: true,
    version: 1,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    tenantId: null,
    code: 'maintenance_update',
    name: 'Maintenance Request Update',
    description: 'Status update for maintenance requests',
    category: 'maintenance',
    channels: ['sms', 'whatsapp', 'email', 'push'],
    variables: [
      { name: 'customerName', description: 'Customer full name', required: true },
      { name: 'workOrderNumber', description: 'Work order reference', required: true },
      { name: 'status', description: 'Current status', required: true },
      { name: 'description', description: 'Issue description', required: false },
      { name: 'scheduledDate', description: 'Scheduled visit date', required: false },
      { name: 'vendorName', description: 'Assigned vendor name', required: false },
    ],
    content: [
      {
        locale: 'en',
        subject: 'Maintenance Update - {{workOrderNumber}}',
        body: `Dear {{customerName}},

Your maintenance request ({{workOrderNumber}}) has been updated.

Status: {{status}}
{{#if description}}Issue: {{description}}{{/if}}
{{#if scheduledDate}}Scheduled: {{scheduledDate}}{{/if}}
{{#if vendorName}}Technician: {{vendorName}}{{/if}}

We will keep you updated on progress.

Best regards,
BOSSNYUMBA`,
        smsBody: 'Maintenance update: {{workOrderNumber}} - {{status}}. {{#if scheduledDate}}Scheduled: {{scheduledDate}}{{/if}}',
        whatsappBody: '🔧 *Maintenance Update*\n\nHi {{customerName}},\n\n📋 Order: {{workOrderNumber}}\n📊 Status: *{{status}}*\n{{#if scheduledDate}}📅 Scheduled: {{scheduledDate}}{{/if}}\n{{#if vendorName}}👷 Tech: {{vendorName}}{{/if}}',
      },
      {
        locale: 'sw',
        subject: 'Taarifa ya Ukarabati - {{workOrderNumber}}',
        body: `Mpendwa {{customerName}},

Ombi lako la ukarabati ({{workOrderNumber}}) limesasishwa.

Hali: {{status}}
{{#if description}}Tatizo: {{description}}{{/if}}
{{#if scheduledDate}}Iliyoratibiwa: {{scheduledDate}}{{/if}}
{{#if vendorName}}Fundi: {{vendorName}}{{/if}}

Tutaendelea kukujulisha.

Wasalaam,
BOSSNYUMBA`,
        smsBody: 'Ukarabati: {{workOrderNumber}} - {{status}}. {{#if scheduledDate}}Tarehe: {{scheduledDate}}{{/if}}',
        whatsappBody: '🔧 *Taarifa ya Ukarabati*\n\nHabari {{customerName}},\n\n📋 Nambari: {{workOrderNumber}}\n📊 Hali: *{{status}}*\n{{#if scheduledDate}}📅 Tarehe: {{scheduledDate}}{{/if}}\n{{#if vendorName}}👷 Fundi: {{vendorName}}{{/if}}',
      },
    ],
    isActive: true,
    isSystemTemplate: true,
    version: 1,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    tenantId: null,
    code: 'lease_expiring',
    name: 'Lease Expiry Notice',
    description: 'Notice sent when lease is expiring',
    category: 'lease',
    channels: ['sms', 'whatsapp', 'email', 'push'],
    variables: [
      { name: 'customerName', description: 'Customer full name', required: true },
      { name: 'expiryDate', description: 'Lease expiry date', required: true },
      { name: 'daysRemaining', description: 'Days until expiry', required: true },
      { name: 'unitNumber', description: 'Unit number', required: false },
      { name: 'renewalLink', description: 'Link to renewal form', required: false },
    ],
    content: [
      {
        locale: 'en',
        subject: 'Your Lease is Expiring Soon',
        body: `Dear {{customerName}},

Your lease {{#if unitNumber}}for unit {{unitNumber}} {{/if}}is expiring on {{expiryDate}} ({{daysRemaining}} days remaining).

If you wish to renew, please contact us or {{#if renewalLink}}click here: {{renewalLink}}{{else}}visit our office{{/if}}.

We value you as a tenant and hope you'll continue to stay with us.

Best regards,
BOSSNYUMBA`,
        smsBody: '{{customerName}}, your lease expires on {{expiryDate}} ({{daysRemaining}} days). Contact us to renew!',
        whatsappBody: '📋 *Lease Expiry Notice*\n\nHi {{customerName}},\n\nYour lease expires on *{{expiryDate}}* ({{daysRemaining}} days).\n\n🏠 We hope you\'ll renew!\n\n{{#if renewalLink}}Click to renew: {{renewalLink}}{{/if}}',
      },
      {
        locale: 'sw',
        subject: 'Mkataba Wako Unakaribia Kumalizika',
        body: `Mpendwa {{customerName}},

Mkataba wako {{#if unitNumber}}wa nyumba {{unitNumber}} {{/if}}unamalizika tarehe {{expiryDate}} (siku {{daysRemaining}} zimebaki).

Ikiwa ungependa kuhuisha, tafadhali wasiliana nasi.

Wasalaam,
BOSSNYUMBA`,
        smsBody: '{{customerName}}, mkataba wako unamalizika tarehe {{expiryDate}} (siku {{daysRemaining}}). Wasiliana nasi!',
        whatsappBody: '📋 *Taarifa ya Mkataba*\n\nHabari {{customerName}},\n\nMkataba wako unamalizika *{{expiryDate}}* (siku {{daysRemaining}}).\n\n🏠 Tunatumai utaendelea kukaa!',
      },
    ],
    isActive: true,
    isSystemTemplate: true,
    version: 1,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    tenantId: null,
    code: 'welcome',
    name: 'Welcome Message',
    description: 'Welcome message for new tenants',
    category: 'onboarding',
    channels: ['sms', 'whatsapp', 'email', 'push'],
    variables: [
      { name: 'customerName', description: 'Customer full name', required: true },
      { name: 'unitNumber', description: 'Unit number', required: false },
      { name: 'propertyName', description: 'Property name', required: false },
      { name: 'moveInDate', description: 'Move-in date', required: false },
      { name: 'managerName', description: 'Property manager name', required: false },
      { name: 'managerPhone', description: 'Property manager phone', required: false },
    ],
    content: [
      {
        locale: 'en',
        subject: 'Welcome to Your New Home!',
        body: `Dear {{customerName}},

Welcome to {{#if propertyName}}{{propertyName}}{{else}}your new home{{/if}}!

{{#if unitNumber}}Your unit: {{unitNumber}}{{/if}}
{{#if moveInDate}}Move-in date: {{moveInDate}}{{/if}}

We're excited to have you as our tenant. Our team is here to ensure you have a comfortable living experience.

{{#if managerName}}
Your property manager is {{managerName}}{{#if managerPhone}} ({{managerPhone}}){{/if}}.
{{/if}}

If you have any questions or need assistance, don't hesitate to reach out.

Welcome home!

Best regards,
BOSSNYUMBA`,
        smsBody: 'Welcome, {{customerName}}! We\'re happy to have you at {{#if propertyName}}{{propertyName}}{{else}}your new home{{/if}}. Contact us if you need anything!',
        whatsappBody: '🏠 *Welcome Home!*\n\nHi {{customerName}},\n\nWelcome to {{#if propertyName}}*{{propertyName}}*{{else}}your new home{{/if}}! 🎉\n\n{{#if unitNumber}}🚪 Unit: {{unitNumber}}{{/if}}\n{{#if moveInDate}}📅 Move-in: {{moveInDate}}{{/if}}\n\nWe\'re excited to have you! 😊',
      },
      {
        locale: 'sw',
        subject: 'Karibu Nyumbani Mpya!',
        body: `Mpendwa {{customerName}},

Karibu {{#if propertyName}}{{propertyName}}{{else}}nyumbani mpya{{/if}}!

{{#if unitNumber}}Nyumba yako: {{unitNumber}}{{/if}}
{{#if moveInDate}}Tarehe ya kuingia: {{moveInDate}}{{/if}}

Tunafuraha kukuwa na wewe kama mpangaji wetu.

{{#if managerName}}
Meneja wako ni {{managerName}}{{#if managerPhone}} ({{managerPhone}}){{/if}}.
{{/if}}

Wasalaam,
BOSSNYUMBA`,
        smsBody: 'Karibu, {{customerName}}! Tunafuraha kukuwa nasi. Wasiliana nasi ukihitaji msaada!',
        whatsappBody: '🏠 *Karibu Nyumbani!*\n\nHabari {{customerName}},\n\nKaribu {{#if propertyName}}*{{propertyName}}*{{else}}nyumbani mpya{{/if}}! 🎉\n\n{{#if unitNumber}}🚪 Nyumba: {{unitNumber}}{{/if}}\n\nTunafuraha! 😊',
      },
    ],
    isActive: true,
    isSystemTemplate: true,
    version: 1,
    createdBy: 'system',
    updatedBy: 'system',
  },
];

// Initialize system templates
function initializeSystemTemplates(): void {
  for (const template of systemTemplates) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const fullTemplate: NotificationTemplate = {
      id,
      ...template,
      createdAt: now,
      updatedAt: now,
    };
    templates.set(id, fullTemplate);

    // Index by code
    if (!templatesByCode.has(template.code)) {
      templatesByCode.set(template.code, []);
    }
    templatesByCode.get(template.code)!.push(fullTemplate);
  }
  logger.info('System templates initialized', { count: systemTemplates.length });
}

initializeSystemTemplates();

// ============================================================================
// Service Implementation
// ============================================================================

export const templateManagementService = {
  /**
   * Create a new template
   */
  async create(input: CreateTemplateInput, createdBy: string): Promise<NotificationTemplate> {
    // Check for duplicate code within tenant
    const existingCode = templatesByCode.get(input.code);
    if (existingCode?.some((t) => t.tenantId === input.tenantId)) {
      throw new Error(`Template with code '${input.code}' already exists`);
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const template: NotificationTemplate = {
      id,
      tenantId: input.tenantId ?? null,
      code: input.code,
      name: input.name,
      description: input.description,
      category: input.category,
      channels: input.channels,
      variables: input.variables,
      content: input.content,
      isActive: true,
      isSystemTemplate: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy,
      updatedBy: createdBy,
    };

    templates.set(id, template);

    // Index by code
    if (!templatesByCode.has(input.code)) {
      templatesByCode.set(input.code, []);
    }
    templatesByCode.get(input.code)!.push(template);

    logger.info('Template created', { id, code: input.code, tenantId: input.tenantId });

    return template;
  },

  /**
   * Get template by ID
   */
  async getById(id: string): Promise<NotificationTemplate | null> {
    return templates.get(id) ?? null;
  },

  /**
   * Get template by code for a tenant (falls back to system template)
   */
  async getByCode(code: string, tenantId: TenantId): Promise<NotificationTemplate | null> {
    const codeTemplates = templatesByCode.get(code);
    if (!codeTemplates) return null;

    // First try tenant-specific template
    const tenantTemplate = codeTemplates.find((t) => t.tenantId === tenantId && t.isActive);
    if (tenantTemplate) return tenantTemplate;

    // Fall back to system template
    const systemTemplate = codeTemplates.find((t) => t.isSystemTemplate && t.isActive);
    return systemTemplate ?? null;
  },

  /**
   * List templates (optionally filtered by tenant)
   */
  async list(
    tenantId?: TenantId,
    options: {
      includeSystem?: boolean;
      category?: TemplateCategory;
      channel?: NotificationChannel;
      activeOnly?: boolean;
    } = {}
  ): Promise<NotificationTemplate[]> {
    const { includeSystem = true, category, channel, activeOnly = true } = options;

    let result = Array.from(templates.values());

    // Filter by tenant
    if (tenantId !== undefined) {
      result = result.filter(
        (t) => t.tenantId === tenantId || (includeSystem && t.isSystemTemplate)
      );
    }

    // Filter by category
    if (category) {
      result = result.filter((t) => t.category === category);
    }

    // Filter by channel
    if (channel) {
      result = result.filter((t) => t.channels.includes(channel));
    }

    // Filter by active status
    if (activeOnly) {
      result = result.filter((t) => t.isActive);
    }

    // Sort by name
    result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  },

  /**
   * Update a template
   */
  async update(
    id: string,
    input: UpdateTemplateInput,
    updatedBy: string
  ): Promise<NotificationTemplate> {
    const existing = templates.get(id);
    if (!existing) {
      throw new Error('Template not found');
    }

    if (existing.isSystemTemplate) {
      throw new Error('Cannot modify system templates');
    }

    const now = new Date().toISOString();
    const updated: NotificationTemplate = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      category: input.category ?? existing.category,
      channels: input.channels ?? existing.channels,
      variables: input.variables ?? existing.variables,
      content: input.content ?? existing.content,
      isActive: input.isActive ?? existing.isActive,
      version: existing.version + 1,
      updatedAt: now,
      updatedBy,
    };

    templates.set(id, updated);

    // Update code index
    const codeTemplates = templatesByCode.get(existing.code);
    if (codeTemplates) {
      const index = codeTemplates.findIndex((t) => t.id === id);
      if (index >= 0) {
        codeTemplates[index] = updated;
      }
    }

    logger.info('Template updated', { id, version: updated.version });

    return updated;
  },

  /**
   * Clone a system template for tenant customization
   */
  async cloneForTenant(
    code: string,
    tenantId: TenantId,
    createdBy: string
  ): Promise<NotificationTemplate> {
    const systemTemplate = await this.getByCode(code, tenantId);
    if (!systemTemplate?.isSystemTemplate) {
      throw new Error('System template not found');
    }

    // Check if tenant already has a customization
    const existing = templatesByCode.get(code);
    if (existing?.some((t) => t.tenantId === tenantId)) {
      throw new Error('Tenant already has a customization for this template');
    }

    return this.create(
      {
        tenantId,
        code,
        name: systemTemplate.name,
        description: systemTemplate.description,
        category: systemTemplate.category,
        channels: systemTemplate.channels,
        variables: systemTemplate.variables,
        content: systemTemplate.content,
      },
      createdBy
    );
  },

  /**
   * Delete a template
   */
  async delete(id: string): Promise<void> {
    const template = templates.get(id);
    if (!template) {
      throw new Error('Template not found');
    }

    if (template.isSystemTemplate) {
      throw new Error('Cannot delete system templates');
    }

    templates.delete(id);

    // Remove from code index
    const codeTemplates = templatesByCode.get(template.code);
    if (codeTemplates) {
      const index = codeTemplates.findIndex((t) => t.id === id);
      if (index >= 0) {
        codeTemplates.splice(index, 1);
      }
    }

    logger.info('Template deleted', { id });
  },

  /**
   * Render a template with variables
   */
  async render(input: RenderTemplateInput): Promise<RenderedTemplate> {
    // Get template
    let template: NotificationTemplate | null = null;
    if (input.templateId) {
      template = await this.getById(input.templateId);
    } else if (input.templateCode) {
      template = await this.getByCode(input.templateCode, input.tenantId);
    }

    if (!template) {
      throw new Error('Template not found');
    }

    // Find content for locale
    let content = template.content.find((c) => c.locale === input.locale);
    if (!content) {
      // Fall back to English
      content = template.content.find((c) => c.locale === 'en');
    }
    if (!content) {
      throw new Error(`No content found for locale '${input.locale}'`);
    }

    // Render with variables
    const rendered: RenderedTemplate = {
      subject: renderWithVariables(content.subject, input.data),
      body: renderWithVariables(content.body, input.data),
      smsBody: content.smsBody ? renderWithVariables(content.smsBody, input.data) : '',
      whatsappBody: content.whatsappBody ? renderWithVariables(content.whatsappBody, input.data) : '',
    };

    return rendered;
  },

  /**
   * Preview a template with sample data
   */
  async preview(
    id: string,
    locale: SupportedLocale
  ): Promise<TemplatePreview> {
    const template = await this.getById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Generate sample data from variables
    const sampleData: Record<string, string> = {};
    for (const variable of template.variables) {
      sampleData[variable.name] = variable.example ?? variable.defaultValue ?? `[${variable.name}]`;
    }

    const rendered = await this.render({
      templateId: id,
      tenantId: template.tenantId ?? ('' as TenantId),
      locale,
      data: sampleData,
      channel: 'email',
    });

    return {
      ...rendered,
      variables: sampleData,
    };
  },

  /**
   * Validate template variables
   */
  validateVariables(
    template: NotificationTemplate,
    data: Record<string, string>
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const variable of template.variables) {
      if (variable.required && !data[variable.name]) {
        missing.push(variable.name);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  },

  /**
   * Get all system template codes
   */
  getSystemTemplateCodes(): string[] {
    return systemTemplates.map((t) => t.code);
  },
};
