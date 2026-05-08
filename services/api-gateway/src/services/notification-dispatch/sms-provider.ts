/**
 * SMS / WhatsApp provider seam for the notification-dispatch worker.
 *
 * Same pattern as the email provider: dispatcher depends on a port,
 * not a concrete rail. Swap the stub for a real adapter at
 * composition time.
 *
 * Real providers TODO (regional priority for TZ/KE/UG):
 *   - Africa's Talking `africastalking.SMS.send` (KE/UG/TZ pan-Africa)
 *   - Twilio `client.messages.create` (global SMS + WhatsApp)
 *   - Beem Africa (TZ-first)
 *   - Infobip / MessageBird
 *
 * The stub signals `not_configured` so the worker handles failure
 * uniformly with the email port.
 */
import { randomUUID } from 'crypto';

export type SmsProviderInput = {
  readonly tenantId: string;
  readonly recipientAddress: string;
  readonly templateKey: string;
  readonly locale: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string | null;
  /**
   * Either 'sms' or 'whatsapp' — the worker forwards the row's
   * channel so the SMS provider can route the right rail.
   */
  readonly channel: 'sms' | 'whatsapp';
};

export type SmsProviderResult =
  | {
      readonly status: 'sent';
      readonly providerRef: string;
      readonly provider: string;
    }
  | {
      readonly status: 'failed';
      readonly errorCode: string;
      readonly errorMessage: string;
      readonly retryable: boolean;
      readonly provider: string;
    };

export type SmsProvider = {
  readonly name: string;
  readonly configured: boolean;
  send(input: SmsProviderInput): Promise<SmsProviderResult>;
};

export function createStubSmsProvider(): SmsProvider {
  return {
    name: 'stub-sms',
    configured: false,
    async send(_input) {
      return {
        status: 'failed',
        errorCode: 'provider_not_configured',
        errorMessage:
          'No real SMS / WhatsApp provider configured; stub returns failed.',
        retryable: true,
        provider: 'stub-sms',
      };
    },
  };
}

export function createInMemorySmsProvider(): SmsProvider & {
  readonly sent: ReadonlyArray<SmsProviderInput>;
} {
  const sent: SmsProviderInput[] = [];
  return {
    name: 'in-memory-sms',
    configured: true,
    get sent() {
      return [...sent];
    },
    async send(input) {
      sent.push(input);
      return {
        status: 'sent',
        providerRef: `mem_${randomUUID()}`,
        provider: 'in-memory-sms',
      };
    },
  };
}
