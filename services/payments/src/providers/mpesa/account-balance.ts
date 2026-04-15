/**
 * M-Pesa Daraja - Account Balance Query
 *
 * Queries the balance of a paybill / till short code. Result is returned
 * asynchronously on the `ResultURL` callback, so this function only
 * initiates the query.
 */
import { ValidationError } from '../../common/errors';
import { logger } from '../../common/logger';
import { withRetry } from '../../common/retry';
import { getMpesaAccessToken } from './auth';
import type { MpesaConfig } from './types';

const ACCOUNT_BALANCE_PATH = '/mpesa/accountbalance/v1/query';

export interface AccountBalanceParams {
  /** Name of the operator/initiator registered on Daraja. */
  initiatorName: string;
  /** Encrypted security credential (RSA-OAEP with Safaricom public key). */
  securityCredential: string;
  /** Short code to query. Defaults to config.shortCode. */
  partyA?: string;
  /** Optional remarks, max 100 chars. */
  remarks?: string;
}

export interface AccountBalanceInitiateResult {
  conversationId: string;
  originatorConversationId: string;
  status: 'PENDING';
  message: string;
}

export async function queryAccountBalance(
  config: MpesaConfig,
  params: AccountBalanceParams
): Promise<AccountBalanceInitiateResult> {
  if (!params.initiatorName) {
    throw new ValidationError('initiatorName is required', 'mpesa');
  }
  if (!params.securityCredential) {
    throw new ValidationError('securityCredential is required', 'mpesa');
  }

  const accessToken = await getMpesaAccessToken(config);

  const baseUrl =
    config.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

  const body = {
    Initiator: params.initiatorName,
    SecurityCredential: params.securityCredential,
    CommandID: 'AccountBalance' as const,
    PartyA: params.partyA ?? config.shortCode,
    IdentifierType: '4', // Organisation short code
    Remarks: (params.remarks ?? 'Balance query').substring(0, 100),
    QueueTimeOutURL: `${config.callbackBaseUrl}/webhooks/mpesa/balance/timeout`,
    ResultURL: `${config.callbackBaseUrl}/webhooks/mpesa/balance/result`,
  };

  const doRequest = async () => {
    const response = await fetch(`${baseUrl}${ACCOUNT_BALANCE_PATH}`, {
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
        `M-Pesa account balance query failed: ${data.ResponseDescription || response.statusText}`,
        'mpesa'
      );
    }

    return {
      conversationId: data.ConversationID!,
      originatorConversationId: data.OriginatorConversationID!,
      status: 'PENDING' as const,
      message: 'Balance query submitted. Result via ResultURL callback.',
    };
  };

  try {
    const result = await withRetry(doRequest);
    logger.info(
      {
        conversationId: result.conversationId,
        shortCode: params.partyA ?? config.shortCode,
        provider: 'mpesa',
      },
      'M-Pesa account balance query initiated'
    );
    return result;
  } catch (err) {
    logger.error(
      { err, provider: 'mpesa' },
      'M-Pesa account balance query failed'
    );
    throw err;
  }
}

/**
 * Parse the asynchronous ResultURL callback for an AccountBalance query.
 *
 * The AccountBalance result comes back with an `AccountBalance` parameter
 * whose value is a pipe/ampersand-separated string per account:
 *   "Working Account|KES|481000.00|481000.00|0.00|0.00&Utility Account|KES|..."
 */
export interface AccountBalanceLine {
  accountName: string;
  currency: string;
  balance: number;
  availableBalance: number;
  reserved: number;
  uncleared: number;
}

export interface AccountBalanceResult {
  conversationId: string;
  status: 'SUCCEEDED' | 'FAILED';
  resultCode: number;
  resultDesc: string;
  balances: AccountBalanceLine[];
}

interface BalanceResultParam {
  Key: string;
  Value: string | number;
}

interface BalanceResultPayload {
  Result?: {
    ResultCode: number;
    ResultDesc: string;
    ConversationID: string;
    ResultParameters?: {
      ResultParameter: BalanceResultParam[];
    };
  };
}

function parseAccountBalanceLines(raw: string): AccountBalanceLine[] {
  if (!raw) return [];
  return raw.split('&').map((chunk) => {
    const parts = chunk.split('|');
    return {
      accountName: parts[0] ?? '',
      currency: parts[1] ?? '',
      balance: parseFloat(parts[2] ?? '0') || 0,
      availableBalance: parseFloat(parts[3] ?? '0') || 0,
      reserved: parseFloat(parts[4] ?? '0') || 0,
      uncleared: parseFloat(parts[5] ?? '0') || 0,
    };
  });
}

export function parseAccountBalanceCallback(
  payload: unknown
): AccountBalanceResult {
  const data = payload as BalanceResultPayload;

  if (!data?.Result) {
    throw new ValidationError(
      'Invalid AccountBalance callback structure',
      'mpesa'
    );
  }

  const { ResultCode, ResultDesc, ConversationID, ResultParameters } = data.Result;
  const params = ResultParameters?.ResultParameter ?? [];
  const balanceEntry = params.find((p) => p.Key === 'AccountBalance');
  const balances = balanceEntry
    ? parseAccountBalanceLines(String(balanceEntry.Value))
    : [];

  return {
    conversationId: ConversationID,
    status: ResultCode === 0 ? 'SUCCEEDED' : 'FAILED',
    resultCode: ResultCode,
    resultDesc: ResultDesc,
    balances,
  };
}
