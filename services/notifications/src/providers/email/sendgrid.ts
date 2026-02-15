/**
 * SendGrid Email Provider
 */

import sgMail from '@sendgrid/mail';
import type { TenantId } from '../../types/index.js';
import type { INotificationProvider, SendParams } from '../provider.interface.js';
import type { NotificationChannel, SendResult } from '../../types/index.js';

export interface SendGridConfig {
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
}

const tenantConfigs = new Map<string, SendGridConfig>();

export class SendGridProvider implements INotificationProvider {
  readonly channel: NotificationChannel = 'email';
  readonly name = 'SendGrid';

  static registerConfig(tenantId: TenantId, config: SendGridConfig): void {
    tenantConfigs.set(tenantId as string, config);
  }

  isConfigured(tenantId: TenantId): boolean {
    return tenantConfigs.has(tenantId as string);
  }

  async send(params: SendParams): Promise<SendResult> {
    const config = tenantConfigs.get(params.tenantId as string);
    if (!config) {
      return { success: false, error: 'SendGrid not configured for tenant' };
    }

    const from = config.fromEmail ?? 'noreply@bossnyumba.com';
    const fromName = config.fromName ?? 'BOSSNYUMBA';

    try {
      sgMail.setApiKey(config.apiKey);
      const [response] = await sgMail.send({
        to: params.to,
        from: { email: from, name: fromName },
        subject: params.subject ?? 'Notification',
        text: params.body,
        html: params.body.replace(/\n/g, '<br>'),
      });

      return {
        success: true,
        externalId: response.headers['x-message-id'] as string | undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}

export const sendGridProvider = new SendGridProvider();
