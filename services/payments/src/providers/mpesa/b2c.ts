/**
 * M-Pesa B2C (Business to Customer) - refunds and disbursements
 */
import { ValidationError } from '../../common/errors';
import { logger } from '../../common/logger';
import { withRetry } from '../../common/retry';
import type { Money } from '../../common/types';
import { getMpesaAccessToken } from './auth';
import type { MpesaConfig } from './types';

const B2C_PATH = '/mpesa/b2c/v1/paymentrequest';

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
}

export interface B2CParams {
  amount: Money;
  phone: string;
  remarks?: string;
  occasion?: string;
  initiatorName?: string;
}

export interface B2CResult {
  conversationId: string;
  originatorConversationId: string;
  status: 'PENDING';
  message: string;
}

export async function initiateB2C(
  config: MpesaConfig,
  params: B2CParams,
  securityCredential: string
): Promise<B2CResult> {
  if (params.amount.currency !== 'KES') {
    throw new ValidationError('M-Pesa B2C only supports KES', 'mpesa');
  }

  const amountMajor = Math.round(params.amount.amountMinorUnits / 100);
  if (amountMajor < 10 || amountMajor > 150000) {
    throw new ValidationError(
      'M-Pesa B2C amount must be between 10 and 150,000 KES',
      'mpesa'
    );
  }

  const phoneNumber = normalizePhone(params.phone);
  if (phoneNumber.length !== 12) {
    throw new ValidationError('Invalid phone number for B2C', 'mpesa');
  }

  const accessToken = await getMpesaAccessToken(config);

  const baseUrl =
    config.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

  const body = {
    InitiatorName: params.initiatorName ?? 'BOSSNYUMBA',
    SecurityCredential: securityCredential,
    CommandID: 'BusinessPayment' as const,
    Amount: amountMajor,
    PartyA: config.shortCode,
    PartyB: phoneNumber,
    Remarks: (params.remarks ?? 'Refund').substring(0, 100),
    QueueTimeOutURL: `${config.callbackBaseUrl}/webhooks/mpesa/b2c/timeout`,
    ResultURL: `${config.callbackBaseUrl}/webhooks/mpesa/b2c/result`,
    Occasion: (params.occasion ?? '').substring(0, 100),
  };

  const doRequest = async () => {
    const response = await fetch(`${baseUrl}${B2C_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      ConversationID?: string;
      OriginatorConversationID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
    };

    if (!response.ok || data.ResponseCode !== '0') {
      throw new ValidationError(
        `M-Pesa B2C failed: ${data.ResponseDescription}`,
        'mpesa'
      );
    }

    return {
      conversationId: data.ConversationID!,
      originatorConversationId: data.OriginatorConversationID!,
      status: 'PENDING' as const,
      message: 'B2C request submitted. Status via callback.',
    };
  };

  try {
    const result = await withRetry(doRequest);
    logger.info(
      {
        conversationId: result.conversationId,
        amount: amountMajor,
        provider: 'mpesa',
      },
      'M-Pesa B2C initiated'
    );
    return result;
  } catch (err) {
    logger.error(
      { err, amount: amountMajor, provider: 'mpesa' },
      'M-Pesa B2C failed'
    );
    throw err;
  }
}
