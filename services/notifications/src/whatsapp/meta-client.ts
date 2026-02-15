/**
 * Meta WhatsApp Business API Client for BOSSNYUMBA
 * Full-featured client with authentication, messaging, media, and webhooks
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import { createLogger } from '../logger.js';
import type {
  WhatsAppBusinessConfig,
  OutgoingTextMessage,
  OutgoingTemplateMessage,
  OutgoingMediaMessage,
  OutgoingInteractiveMessage,
  OutgoingLocationMessage,
  SendMessageResponse,
  MediaUploadResponse,
  MediaDownloadResponse,
  WhatsAppWebhookPayload,
  IncomingMessage,
  MessageStatusUpdate,
  TemplateComponent,
  InteractiveHeader,
  InteractiveButton,
  InteractiveSection,
  SupportedLanguage,
} from './types.js';

const logger = createLogger('WhatsAppMetaClient');

// ============================================================================
// Error Classes
// ============================================================================

export class WhatsAppAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: number,
    public errorSubcode?: number,
    public fbTraceId?: string
  ) {
    super(message);
    this.name = 'WhatsAppAPIError';
  }
}

export class WhatsAppRateLimitError extends WhatsAppAPIError {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message, 429);
    this.name = 'WhatsAppRateLimitError';
  }
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: Partial<WhatsAppBusinessConfig> = {
  apiUrl: 'https://graph.facebook.com/v18.0',
  defaultLanguage: 'en',
  sessionTimeoutMinutes: 30,
  emergencyKeywords: {
    en: ['fire', 'flood', 'emergency', 'break-in', 'gas leak'],
    sw: ['moto', 'mafuriko', 'dharura', 'uvamizi', 'gesi'],
  },
  emergencyContacts: [],
};

// ============================================================================
// Meta WhatsApp Business API Client
// ============================================================================

export class MetaWhatsAppClient {
  private config: WhatsAppBusinessConfig;
  private client: AxiosInstance;

  constructor(config?: Partial<WhatsAppBusinessConfig>) {
    this.config = {
      apiUrl: config?.apiUrl || process.env['WHATSAPP_API_URL'] || DEFAULT_CONFIG.apiUrl!,
      accessToken: config?.accessToken || process.env['WHATSAPP_ACCESS_TOKEN'] || '',
      phoneNumberId: config?.phoneNumberId || process.env['WHATSAPP_PHONE_NUMBER_ID'] || '',
      businessAccountId: config?.businessAccountId || process.env['WHATSAPP_BUSINESS_ACCOUNT_ID'] || '',
      webhookVerifyToken: config?.webhookVerifyToken || process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'] || '',
      appSecret: config?.appSecret || process.env['WHATSAPP_APP_SECRET'] || '',
      defaultLanguage: config?.defaultLanguage || DEFAULT_CONFIG.defaultLanguage!,
      sessionTimeoutMinutes: config?.sessionTimeoutMinutes || DEFAULT_CONFIG.sessionTimeoutMinutes!,
      emergencyKeywords: config?.emergencyKeywords || DEFAULT_CONFIG.emergencyKeywords!,
      emergencyContacts: config?.emergencyContacts || DEFAULT_CONFIG.emergencyContacts!,
    };

    this.client = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => this.handleAPIError(error)
    );
  }

  // ============================================================================
  // Phone Number Formatting
  // ============================================================================

  /**
   * Format phone number to WhatsApp format (E.164 without +)
   * Supports East African numbers (Kenya, Tanzania, Uganda)
   */
  formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    // Remove leading zeros
    if (cleaned.startsWith('0')) {
      // Detect country based on number pattern
      if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
        // Kenya mobile numbers
        cleaned = '254' + cleaned.slice(1);
      } else if (cleaned.startsWith('06') || cleaned.startsWith('07')) {
        // Tanzania mobile numbers
        cleaned = '255' + cleaned.slice(1);
      } else if (cleaned.startsWith('07')) {
        // Uganda mobile numbers
        cleaned = '256' + cleaned.slice(1);
      } else {
        // Default to Tanzania
        cleaned = '255' + cleaned.slice(1);
      }
    }

    // Handle + prefix
    if (phone.startsWith('+')) {
      cleaned = phone.replace(/\D/g, '');
    }

    return cleaned;
  }

  // ============================================================================
  // Text Messages
  // ============================================================================

  /**
   * Send a simple text message
   */
  async sendText(message: OutgoingTextMessage): Promise<SendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(message.to),
      type: 'text',
      text: {
        preview_url: message.previewUrl ?? false,
        body: message.text,
      },
    };

    logger.info('Sending text message', { to: message.to });
    const response = await this.client.post<SendMessageResponse>(
      `/${this.config.phoneNumberId}/messages`,
      payload
    );
    logger.debug('Text message sent', { messageId: response.data.messages?.[0]?.id });
    
    return response.data;
  }

  /**
   * Send text message with reply context (thread)
   */
  async sendTextReply(
    to: string,
    text: string,
    replyToMessageId: string
  ): Promise<SendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'text',
      context: {
        message_id: replyToMessageId,
      },
      text: {
        body: text,
      },
    };

    const response = await this.client.post<SendMessageResponse>(
      `/${this.config.phoneNumberId}/messages`,
      payload
    );
    
    return response.data;
  }

  // ============================================================================
  // Template Messages
  // ============================================================================

  /**
   * Send a pre-approved template message
   */
  async sendTemplate(message: OutgoingTemplateMessage): Promise<SendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(message.to),
      type: 'template',
      template: {
        name: message.templateName,
        language: { code: message.languageCode },
        components: message.components,
      },
    };

    logger.info('Sending template message', { 
      to: message.to, 
      template: message.templateName 
    });
    const response = await this.client.post<SendMessageResponse>(
      `/${this.config.phoneNumberId}/messages`,
      payload
    );
    
    return response.data;
  }

  /**
   * Helper to create template components
   */
  createTemplateComponents(params: {
    headerParams?: Array<{ type: 'text' | 'image' | 'document'; value: string }>;
    bodyParams?: string[];
    buttonParams?: Array<{ type: 'quick_reply' | 'url'; payload?: string; text?: string }>;
  }): TemplateComponent[] {
    const components: TemplateComponent[] = [];

    if (params.headerParams && params.headerParams.length > 0) {
      components.push({
        type: 'header',
        parameters: params.headerParams.map((p) => {
          if (p.type === 'text') {
            return { type: 'text', text: p.value };
          } else if (p.type === 'image') {
            return { type: 'image', image: { link: p.value } };
          } else {
            return { type: 'document', document: { link: p.value } };
          }
        }),
      });
    }

    if (params.bodyParams && params.bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: params.bodyParams.map((text) => ({ type: 'text', text })),
      });
    }

    if (params.buttonParams && params.buttonParams.length > 0) {
      params.buttonParams.forEach((btn, index) => {
        components.push({
          type: 'button',
          sub_type: btn.type,
          index,
          parameters: btn.payload 
            ? [{ type: 'payload', payload: btn.payload }]
            : [{ type: 'text', text: btn.text || '' }],
        });
      });
    }

    return components;
  }

  // ============================================================================
  // Media Messages
  // ============================================================================

  /**
   * Send a media message (image, document, audio, video)
   */
  async sendMedia(message: OutgoingMediaMessage): Promise<SendMessageResponse> {
    const mediaPayload: Record<string, unknown> = {
      link: message.mediaUrl,
    };

    if (message.caption) {
      mediaPayload.caption = message.caption;
    }

    if (message.type === 'document' && message.filename) {
      mediaPayload.filename = message.filename;
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(message.to),
      type: message.type,
      [message.type]: mediaPayload,
    };

    logger.info('Sending media message', { to: message.to, type: message.type });
    const response = await this.client.post<SendMessageResponse>(
      `/${this.config.phoneNumberId}/messages`,
      payload
    );
    
    return response.data;
  }

  /**
   * Upload media to WhatsApp servers
   */
  async uploadMedia(
    fileBuffer: Buffer,
    mimeType: string,
    filename?: string
  ): Promise<MediaUploadResponse> {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    form.append('messaging_product', 'whatsapp');
    form.append('file', fileBuffer, {
      filename: filename || 'file',
      contentType: mimeType,
    });

    const response = await this.client.post<MediaUploadResponse>(
      `/${this.config.phoneNumberId}/media`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${this.config.accessToken}`,
        },
      }
    );

    return response.data;
  }

  /**
   * Get media download URL
   */
  async getMediaUrl(mediaId: string): Promise<MediaDownloadResponse> {
    const response = await this.client.get<MediaDownloadResponse>(`/${mediaId}`);
    return response.data;
  }

  /**
   * Download media file
   */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    const mediaInfo = await this.getMediaUrl(mediaId);
    
    const response = await axios.get(mediaInfo.url, {
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
      },
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
  }

  // ============================================================================
  // Interactive Messages
  // ============================================================================

  /**
   * Send an interactive message with buttons
   */
  async sendButtons(
    to: string,
    body: string,
    buttons: InteractiveButton[],
    options?: {
      header?: InteractiveHeader;
      footer?: string;
    }
  ): Promise<SendMessageResponse> {
    const interactive: Record<string, unknown> = {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title.slice(0, 20) },
        })),
      },
    };

    if (options?.header) {
      interactive.header = this.formatInteractiveHeader(options.header);
    }

    if (options?.footer) {
      interactive.footer = { text: options.footer };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'interactive',
      interactive,
    };

    const response = await this.client.post<SendMessageResponse>(
      `/${this.config.phoneNumberId}/messages`,
      payload
    );
    
    return response.data;
  }

  /**
   * Send an interactive list message
   */
  async sendList(
    to: string,
    body: string,
    sections: InteractiveSection[],
    options?: {
      header?: InteractiveHeader;
      footer?: string;
      buttonText?: string;
    }
  ): Promise<SendMessageResponse> {
    const interactive: Record<string, unknown> = {
      type: 'list',
      body: { text: body },
      action: {
        button: options?.buttonText || 'View Options',
        sections: sections.map((section) => ({
          title: section.title,
          rows: section.rows.map((row) => ({
            id: row.id,
            title: row.title.slice(0, 24),
            description: row.description?.slice(0, 72),
          })),
        })),
      },
    };

    if (options?.header) {
      interactive.header = this.formatInteractiveHeader(options.header);
    }

    if (options?.footer) {
      interactive.footer = { text: options.footer };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(to),
      type: 'interactive',
      interactive,
    };

    const response = await this.client.post<SendMessageResponse>(
      `/${this.config.phoneNumberId}/messages`,
      payload
    );
    
    return response.data;
  }

  /**
   * Send interactive message (unified method)
   */
  async sendInteractive(message: OutgoingInteractiveMessage): Promise<SendMessageResponse> {
    if (message.type === 'button' && message.buttons) {
      return this.sendButtons(message.to, message.body, message.buttons, {
        header: message.header,
        footer: message.footer,
      });
    } else if (message.type === 'list' && message.sections) {
      return this.sendList(message.to, message.body, message.sections, {
        header: message.header,
        footer: message.footer,
        buttonText: message.buttonText,
      });
    }

    throw new Error('Invalid interactive message type');
  }

  private formatInteractiveHeader(header: InteractiveHeader): Record<string, unknown> {
    const formatted: Record<string, unknown> = { type: header.type };
    
    switch (header.type) {
      case 'text':
        formatted.text = header.text;
        break;
      case 'image':
        formatted.image = header.image;
        break;
      case 'document':
        formatted.document = header.document;
        break;
      case 'video':
        formatted.video = header.video;
        break;
    }

    return formatted;
  }

  // ============================================================================
  // Location Messages
  // ============================================================================

  /**
   * Send a location message
   */
  async sendLocation(message: OutgoingLocationMessage): Promise<SendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(message.to),
      type: 'location',
      location: {
        latitude: message.latitude,
        longitude: message.longitude,
        name: message.name,
        address: message.address,
      },
    };

    const response = await this.client.post<SendMessageResponse>(
      `/${this.config.phoneNumberId}/messages`,
      payload
    );
    
    return response.data;
  }

  // ============================================================================
  // Message Status
  // ============================================================================

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.client.post(`/${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });

    logger.debug('Message marked as read', { messageId });
  }

  /**
   * React to a message with an emoji
   */
  async reactToMessage(messageId: string, emoji: string): Promise<SendMessageResponse> {
    const response = await this.client.post<SendMessageResponse>(
      `/${this.config.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        type: 'reaction',
        reaction: {
          message_id: messageId,
          emoji,
        },
      }
    );

    return response.data;
  }

  // ============================================================================
  // Webhook Handling
  // ============================================================================

  /**
   * Verify webhook subscription (GET request)
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
      logger.info('Webhook verified successfully');
      return challenge;
    }
    logger.warn('Webhook verification failed', { mode, tokenMatch: token === this.config.webhookVerifyToken });
    return null;
  }

  /**
   * Validate webhook signature (X-Hub-Signature-256)
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.appSecret) {
      logger.warn('App secret not configured, skipping signature validation');
      return true;
    }

    const expectedSignature = 'sha256=' + 
      crypto.createHmac('sha256', this.config.appSecret)
        .update(payload)
        .digest('hex');

    const valid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!valid) {
      logger.warn('Webhook signature validation failed');
    }

    return valid;
  }

  /**
   * Parse incoming webhook payload
   */
  parseWebhookPayload(body: unknown): {
    messages: IncomingMessage[];
    statuses: MessageStatusUpdate[];
    contacts: Array<{ wa_id: string; name: string }>;
  } {
    const result = {
      messages: [] as IncomingMessage[],
      statuses: [] as MessageStatusUpdate[],
      contacts: [] as Array<{ wa_id: string; name: string }>,
    };

    try {
      const data = body as WhatsAppWebhookPayload;

      if (data.object !== 'whatsapp_business_account') {
        return result;
      }

      for (const entry of data.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          
          if (value.messages) {
            result.messages.push(...value.messages);
          }
          
          if (value.statuses) {
            result.statuses.push(...value.statuses);
          }

          if (value.contacts) {
            result.contacts.push(
              ...value.contacts.map((c) => ({
                wa_id: c.wa_id,
                name: c.profile.name,
              }))
            );
          }
        }
      }
    } catch (error) {
      logger.error('Failed to parse webhook payload', { error });
    }

    return result;
  }

  // ============================================================================
  // Business Profile
  // ============================================================================

  /**
   * Get business profile
   */
  async getBusinessProfile(): Promise<Record<string, unknown>> {
    const response = await this.client.get(
      `/${this.config.phoneNumberId}/whatsapp_business_profile`,
      {
        params: {
          fields: 'about,address,description,email,profile_picture_url,websites,vertical',
        },
      }
    );
    return response.data;
  }

  /**
   * Update business profile
   */
  async updateBusinessProfile(profile: {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    vertical?: string;
    websites?: string[];
  }): Promise<void> {
    await this.client.post(`/${this.config.phoneNumberId}/whatsapp_business_profile`, {
      messaging_product: 'whatsapp',
      ...profile,
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Handle API errors
   */
  private handleAPIError(error: AxiosError): never {
    const response = error.response;
    
    if (response) {
      const data = response.data as Record<string, unknown>;
      const errorObj = data?.error as Record<string, unknown> | undefined;
      
      if (response.status === 429) {
        throw new WhatsAppRateLimitError(
          errorObj?.message as string || 'Rate limit exceeded',
          response.headers['retry-after'] ? parseInt(response.headers['retry-after'] as string) : undefined
        );
      }

      throw new WhatsAppAPIError(
        errorObj?.message as string || 'API request failed',
        response.status,
        errorObj?.code as number,
        errorObj?.error_subcode as number,
        errorObj?.fbtrace_id as string
      );
    }

    throw new WhatsAppAPIError(error.message || 'Network error');
  }

  /**
   * Get configuration
   */
  getConfig(): WhatsAppBusinessConfig {
    return { ...this.config };
  }

  /**
   * Update access token (for token refresh)
   */
  updateAccessToken(newToken: string): void {
    this.config.accessToken = newToken;
    this.client.defaults.headers['Authorization'] = `Bearer ${newToken}`;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const metaWhatsAppClient = new MetaWhatsAppClient();
