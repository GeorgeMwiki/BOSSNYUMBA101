/**
 * M-Pesa Daraja - Transaction Status Query
 *
 * Generic transaction status query. Unlike StkPushQuery (which only works for
 * STK Push) this endpoint works for any Daraja transaction (B2C, C2B, reversal
 * etc.). Result is delivered asynchronously on the ResultURL callback.
 */
import { ValidationError } from '../../common/errors';
import { logger } from '../../common/logger';
import { withRetry } from '../../common/retry';
import { getMpesaAccessToken } from './auth';
import type { MpesaConfig } from './types';

const TRANSACTION_STATUS_PATH = '/mpesa/transactionstatus/v1/query';

export interface TransactionStatusParams {
  initiatorName: string;
  securityCredential: string;
  /** M-Pesa transaction ID (e.g. receipt number "NLJ7RT61SV"). */
  transactionId: string;
  /** Short code or MSISDN to query. */
  partyA?: string;
  /** 1=MSISDN, 2=Till Number, 4=Organisation shortcode. Defaults to 4. */
  identifierType?: '1' | '2' | '4';
  remarks?: string;
  occasion?: string;
}

export interface TransactionStatusInitiateResult {
  conversationId: string;
  originatorConversationId: string;
  status: 'PENDING';
  message: string;
}

export async function queryTransactionStatus(
  config: MpesaConfig,
  params: TransactionStatusParams
): Promise<TransactionStatusInitiateResult> {
  if (!params.transactionId) {
    throw new ValidationError('transactionId is required', 'mpesa');
  }
  if (!params.initiatorName || !params.securityCredential) {
    throw new ValidationError(
      'initiatorName and securityCredential are required',
      'mpesa'
    );
  }

  const accessToken = await getMpesaAccessToken(config);

  const baseUrl =
    config.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

  const body = {
    Initiator: params.initiatorName,
    SecurityCredential: params.securityCredential,
    CommandID: 'TransactionStatusQuery' as const,
    TransactionID: params.transactionId,
    PartyA: params.partyA ?? config.shortCode,
    IdentifierType: params.identifierType ?? '4',
    ResultURL: `${config.callbackBaseUrl}/webhooks/mpesa/txstatus/result`,
    QueueTimeOutURL: `${config.callbackBaseUrl}/webhooks/mpesa/txstatus/timeout`,
    Remarks: (params.remarks ?? 'Status query').substring(0, 100),
    Occasion: (params.occasion ?? '').substring(0, 100),
  };

  const doRequest = async () => {
    const response = await fetch(`${baseUrl}${TRANSACTION_STATUS_PATH}`, {
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
        `M-Pesa transaction status query failed: ${data.ResponseDescription || response.statusText}`,
        'mpesa'
      );
    }

    return {
      conversationId: data.ConversationID!,
      originatorConversationId: data.OriginatorConversationID!,
      status: 'PENDING' as const,
      message: 'Transaction status query submitted. Result via ResultURL callback.',
    };
  };

  try {
    const result = await withRetry(doRequest);
    logger.info(
      {
        conversationId: result.conversationId,
        transactionId: params.transactionId,
        provider: 'mpesa',
      },
      'M-Pesa transaction status query initiated'
    );
    return result;
  } catch (err) {
    logger.error(
      { err, transactionId: params.transactionId, provider: 'mpesa' },
      'M-Pesa transaction status query failed'
    );
    throw err;
  }
}
