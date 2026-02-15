import axios, { AxiosInstance } from 'axios';

export interface WhatsAppConfig {
  apiUrl: string;
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
}

export interface TextMessage {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface TemplateMessage {
  to: string;
  templateName: string;
  languageCode: string;
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string; filename?: string };
}

export interface MediaMessage {
  to: string;
  type: 'image' | 'document' | 'audio' | 'video';
  mediaUrl: string;
  caption?: string;
  filename?: string;
}

export interface InteractiveMessage {
  to: string;
  type: 'button' | 'list';
  header?: { type: 'text'; text: string };
  body: string;
  footer?: string;
  buttons?: Array<{ id: string; title: string }>;
  sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export interface SendMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contacts' | 'interactive' | 'button';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string };
  document?: { id: string; mime_type: string; sha256: string; filename: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
}

export class WhatsAppClient {
  private config: WhatsAppConfig;
  private client: AxiosInstance;

  constructor(config?: Partial<WhatsAppConfig>) {
    this.config = {
      apiUrl: config?.apiUrl || process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
      accessToken: config?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: config?.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      webhookVerifyToken: config?.webhookVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    };

    this.client = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Format phone number to WhatsApp format
   */
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.slice(1); // Kenya default
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.slice(1);
    }

    return cleaned;
  }

  /**
   * Send a text message
   */
  async sendText(message: TextMessage): Promise<SendMessageResponse> {
    const response = await this.client.post<SendMessageResponse>(`/${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(message.to),
      type: 'text',
      text: {
        preview_url: message.previewUrl ?? false,
        body: message.text,
      },
    });

    return response.data;
  }

  /**
   * Send a template message
   */
  async sendTemplate(message: TemplateMessage): Promise<SendMessageResponse> {
    const response = await this.client.post<SendMessageResponse>(`/${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(message.to),
      type: 'template',
      template: {
        name: message.templateName,
        language: { code: message.languageCode },
        components: message.components,
      },
    });

    return response.data;
  }

  /**
   * Send a media message (image, document, audio, video)
   */
  async sendMedia(message: MediaMessage): Promise<SendMessageResponse> {
    const mediaObject: Record<string, unknown> = {
      link: message.mediaUrl,
    };

    if (message.caption) {
      mediaObject.caption = message.caption;
    }

    if (message.type === 'document' && message.filename) {
      mediaObject.filename = message.filename;
    }

    const response = await this.client.post<SendMessageResponse>(`/${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(message.to),
      type: message.type,
      [message.type]: mediaObject,
    });

    return response.data;
  }

  /**
   * Send an interactive message (buttons or list)
   */
  async sendInteractive(message: InteractiveMessage): Promise<SendMessageResponse> {
    const interactive: Record<string, unknown> = {
      type: message.type,
      body: { text: message.body },
    };

    if (message.header) {
      interactive.header = message.header;
    }

    if (message.footer) {
      interactive.footer = { text: message.footer };
    }

    if (message.type === 'button' && message.buttons) {
      interactive.action = {
        buttons: message.buttons.map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title },
        })),
      };
    }

    if (message.type === 'list' && message.sections) {
      interactive.action = {
        button: 'View Options',
        sections: message.sections,
      };
    }

    const response = await this.client.post<SendMessageResponse>(`/${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.formatPhoneNumber(message.to),
      type: 'interactive',
      interactive,
    });

    return response.data;
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.client.post(`/${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  /**
   * Send rent reminder notification
   */
  async sendRentReminder(
    phoneNumber: string,
    tenantName: string,
    amount: number,
    dueDate: string,
    propertyName: string
  ): Promise<SendMessageResponse> {
    return this.sendTemplate({
      to: phoneNumber,
      templateName: 'rent_reminder',
      languageCode: 'en',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: tenantName },
            { type: 'currency', currency: { fallback_value: `KES ${amount}`, code: 'KES', amount_1000: amount * 1000 } },
            { type: 'text', text: dueDate },
            { type: 'text', text: propertyName },
          ],
        },
      ],
    });
  }

  /**
   * Send payment confirmation
   */
  async sendPaymentConfirmation(
    phoneNumber: string,
    tenantName: string,
    amount: number,
    receiptNumber: string,
    balance: number
  ): Promise<SendMessageResponse> {
    return this.sendTemplate({
      to: phoneNumber,
      templateName: 'payment_confirmation',
      languageCode: 'en',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: tenantName },
            { type: 'currency', currency: { fallback_value: `KES ${amount}`, code: 'KES', amount_1000: amount * 1000 } },
            { type: 'text', text: receiptNumber },
            { type: 'currency', currency: { fallback_value: `KES ${balance}`, code: 'KES', amount_1000: balance * 1000 } },
          ],
        },
      ],
    });
  }

  /**
   * Send maintenance update
   */
  async sendMaintenanceUpdate(
    phoneNumber: string,
    tenantName: string,
    ticketId: string,
    status: string,
    message: string
  ): Promise<SendMessageResponse> {
    return this.sendText({
      to: phoneNumber,
      text: `Hi ${tenantName},\n\nYour maintenance request #${ticketId} has been updated.\n\nStatus: ${status}\n\n${message}\n\nThank you,\nProperty Management`,
    });
  }

  /**
   * Verify webhook subscription
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Parse incoming webhook payload
   */
  parseWebhookPayload(body: unknown): WebhookMessage[] {
    const messages: WebhookMessage[] = [];

    try {
      const data = body as {
        entry?: Array<{
          changes?: Array<{
            value?: {
              messages?: WebhookMessage[];
            };
          }>;
        }>;
      };

      if (data.entry) {
        for (const entry of data.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.value?.messages) {
                messages.push(...change.value.messages);
              }
            }
          }
        }
      }
    } catch {
      // Invalid payload
    }

    return messages;
  }
}

export const whatsAppClient = new WhatsAppClient();
