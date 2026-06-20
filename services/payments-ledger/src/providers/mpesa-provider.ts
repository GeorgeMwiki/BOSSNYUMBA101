/**
 * M-PESA Payment Provider Implementation
 * Implements the payment provider interface for Safaricom M-PESA
 *
 * Note: This is a skeleton implementation. Actual M-PESA integration
 * requires registration with Safaricom and access to the Daraja API.
 */
import {
  publicEncrypt,
  constants,
  createPublicKey,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  Money,
  TenantId,
  CustomerId,
  CurrencyCode
} from '@bossnyumba/domain-models';
import type { PaymentStatus } from '../types';
import { logger } from '../logger.js';

/**
 * RSA-encrypt the initiator password with Safaricom's public cert so
 * Daraja accepts the B2C request. PKCS1 v1.5 padding is the spec.
 */
function buildSecurityCredential(
  initiatorPassword: string,
  env: 'sandbox' | 'production'
): string {
  const envVar = env === 'production' ? 'MPESA_PRODUCTION_CERT' : 'MPESA_SANDBOX_CERT';
  let pem = process.env[envVar]?.trim();
  if (!pem) {
    const certPath = process.env.MPESA_CERT_PATH?.trim();
    if (certPath) {
      try {
        // Path comes from operator-controlled env var; validate it's an
        // absolute path and not obviously hostile before reading.
        if (!certPath.startsWith('/') || certPath.includes('\0')) {
          throw new Error('MPESA_CERT_PATH must be an absolute path');
        }
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- operator-supplied absolute path
        pem = readFileSync(certPath, 'utf-8');
      } catch (err) {
        throw new Error(
          `Failed to read MPESA_CERT_PATH ${certPath}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }
  if (!pem) {
    throw new Error(
      `Missing M-Pesa ${env} certificate. Set ${envVar} (PEM) or MPESA_CERT_PATH. ` +
        'Download from https://developer.safaricom.co.ke/.'
    );
  }
  const key = createPublicKey(pem);
  const ciphertext = publicEncrypt(
    { key, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(initiatorPassword, 'utf-8')
  );
  return ciphertext.toString('base64');
}
import {
  BasePaymentProvider,
  CreatePaymentResult,
  CapturePaymentResult,
  RefundResult,
  TransferResult,
  ProviderCustomer,
  ProviderPaymentMethod,
  ProviderWebhookEvent,
  ConnectedAccount
} from './payment-provider.interface';

/**
 * Thrown by {@link MpesaPaymentProvider.getTransferStatus}. B2C is a
 * callback-only rail — delivery status cannot be polled synchronously. The
 * disbursement-reconciliation sweep catches this and leaves the row
 * NEEDS_REVERSAL (flagged loud) instead of guessing the outcome. A distinct
 * class (not a bare Error) lets a caller/test assert the callback-only contract.
 */
export class MpesaCallbackOnlyStatusError extends Error {
  readonly code = 'MPESA_TRANSFER_STATUS_CALLBACK_ONLY';
  constructor(public readonly transferId: string) {
    super(
      `M-PESA B2C transfer status is callback-only (ConversationID ${transferId}); ` +
        'the outcome arrives at /webhooks/mpesa/b2c/{result,timeout}, not via a poll.',
    );
    this.name = 'MpesaCallbackOnlyStatusError';
  }
}

/**
 * Thrown by {@link MpesaPaymentProvider.createPaymentIntent} when an STK Push
 * intent carries sub-major-unit precision (e.g. KES 100.50). M-PESA STK can
 * only ever charge a WHOLE number of major units — the Daraja `Amount` field
 * is whole-shilling. If we silently `Math.round()` here the customer is charged
 * a different figure than the ledger books `paymentIntent.amount` exactly
 * (payment-orchestration.service.ts ~593-622), so cash collected != cash
 * booked. We fail CLOSED at intent creation instead: the caller must quantize
 * the intent to a whole major unit BEFORE choosing the M-PESA STK rail, so
 * `intent.amount` is already whole-unit and ledger == cash. A distinct class
 * (not a bare Error) lets callers/tests assert the quantize-at-creation
 * contract.
 */
export class MpesaSubUnitAmountError extends Error {
  readonly code = 'MPESA_STK_AMOUNT_NOT_WHOLE_UNIT';
  constructor(
    public readonly amountMinorUnits: number,
    public readonly currency: CurrencyCode,
  ) {
    super(
      `M-PESA STK Push requires a whole-major-unit amount (${currency}); ` +
        `received ${amountMinorUnits} minor units which is not a whole ${currency}. ` +
        'Quantize the payment intent to a whole major unit before initiating ' +
        'STK Push so the charged amount matches the booked ledger amount.',
    );
    this.name = 'MpesaSubUnitAmountError';
  }
}

export interface MpesaProviderConfig {
  consumerKey: string;
  consumerSecret: string;
  shortCode: string;
  passKey: string;
  environment: 'sandbox' | 'production';
  callbackBaseUrl: string;
}

interface MpesaToken {
  accessToken: string;
  expiresAt: Date;
}

/**
 * M-PESA Payment Provider
 * Supports STK Push (Lipa Na M-PESA) and B2C (Business to Customer) payments
 */
export class MpesaPaymentProvider extends BasePaymentProvider {
  readonly name = 'mpesa';
  readonly supportedCurrencies: CurrencyCode[] = ['KES'];

  private config: MpesaProviderConfig;
  private token: MpesaToken | null = null;
  private baseUrl: string;

  constructor(config: MpesaProviderConfig) {
    super();
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  /**
   * Get OAuth access token from M-PESA
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.token && this.token.expiresAt > new Date()) {
      return this.token.accessToken;
    }

    const auth = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`
    ).toString('base64');

    const response = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`M-PESA auth failed: ${response.statusText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: string };

    // Bug fix A-BUG-DEEP #13: `parseInt(data.expires_in)` previously
    // missed the radix (silently broke if Safaricom ever prefixed the
    // value with "0x"), and a malformed payload (`NaN`) would produce
    // an "Invalid Date" expiresAt that always tested as expired. Guard
    // both: radix-10 parse + `Number.isFinite` check, defaulting to the
    // documented Safaricom token TTL (3600s).
    const expiresInRaw = parseInt(String(data.expires_in), 10);
    const expiresInSec = Number.isFinite(expiresInRaw) && expiresInRaw > 0 ? expiresInRaw : 3600;
    this.token = {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + expiresInSec * 1000 - 60000)
    };

    return this.token.accessToken;
  }

  /**
   * Generate M-PESA password for STK Push
   */
  private generatePassword(): { password: string; timestamp: string } {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .substring(0, 14);
    
    const password = Buffer.from(
      `${this.config.shortCode}${this.config.passKey}${timestamp}`
    ).toString('base64');

    return { password, timestamp };
  }

  async createCustomer(
    tenantId: TenantId,
    customerId: CustomerId,
    email: string,
    name?: string,
    metadata?: Record<string, string>
  ): Promise<ProviderCustomer> {
    // M-PESA doesn't have a customer concept like Stripe
    // We just return a pseudo-customer based on our internal ID
    return {
      externalId: `mpesa_${tenantId}_${customerId}`,
      email,
      name,
      metadata: {
        tenantId,
        customerId,
        ...metadata
      }
    };
  }

  async getCustomer(externalCustomerId: string): Promise<ProviderCustomer | null> {
    // Parse the customer ID we created
    const parts = externalCustomerId.split('_');
    if (parts.length < 3 || parts[0] !== 'mpesa') {
      return null;
    }
    return {
      externalId: externalCustomerId,
      metadata: {
        tenantId: parts[1],
        customerId: parts[2]
      }
    };
  }

  async createPaymentIntent(params: {
    amount: Money;
    customerId: string;
    paymentMethodId?: string;  // Phone number for M-PESA
    description?: string;
    statementDescriptor?: string;
    metadata?: Record<string, string>;
    idempotencyKey: string;
    applicationFeeAmount?: Money;
    transferDestination?: string;
  }): Promise<CreatePaymentResult> {
    if (!params.paymentMethodId) {
      // Return pending status - need phone number to initiate
      return {
        externalId: `pending_${params.idempotencyKey}`,
        status: 'PENDING',
        instructions: 'Please provide phone number to initiate M-PESA payment'
      };
    }

    // MONEY (stk-rounding): M-PESA STK can only charge a WHOLE number of major
    // units, but the ledger books `paymentIntent.amount` to the exact minor
    // unit (payment-orchestration.service.ts ~593-622). If the intent carries
    // sub-major-unit precision (e.g. KES 100.50) we cannot reconcile cash
    // collected against cash booked — `Math.round` would charge a different
    // figure than is booked. Fail CLOSED here: the caller must quantize the
    // intent to a whole major unit BEFORE selecting the STK rail so
    // intent.amount is already whole-unit and ledger == cash. We do NOT round
    // silently. `amountMajorUnits` derives the major value currency-aware
    // (minor ÷ 10^decimals), so this also holds for 0-decimal currencies where
    // every amount is already whole.
    const majorUnits = params.amount.amountMajorUnits;
    if (!Number.isInteger(majorUnits)) {
      throw new MpesaSubUnitAmountError(
        params.amount.amountMinorUnits,
        params.amount.currency,
      );
    }

    const accessToken = await this.getAccessToken();
    const { password, timestamp } = this.generatePassword();

    // Clean phone number (remove + and ensure it starts with 254)
    let phoneNumber = params.paymentMethodId.replace(/[^0-9]/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '254' + phoneNumber.substring(1);
    }
    if (!phoneNumber.startsWith('254')) {
      phoneNumber = '254' + phoneNumber;
    }

    const stkPushRequest = {
      BusinessShortCode: this.config.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: majorUnits, // already whole-unit (guarded above) — charged == booked
      PartyA: phoneNumber,
      PartyB: this.config.shortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: `${this.config.callbackBaseUrl}/webhooks/mpesa/stk`,
      AccountReference: params.metadata?.accountReference || 'BOSSNYUMBA',
      TransactionDesc: params.description?.substring(0, 13) || 'Payment'
    };

    const response = await fetch(
      `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stkPushRequest)
      }
    );

    const data = await response.json() as {
      CheckoutRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };

    if (!response.ok || data.ResponseCode !== '0') {
      throw new Error(
        `M-PESA STK Push failed: ${data.errorMessage || data.ResponseDescription}`
      );
    }

    return {
      externalId: data.CheckoutRequestID!,
      status: 'PROCESSING',
      instructions: 'Please check your phone and enter M-PESA PIN to complete payment'
    };
  }

  async confirmPaymentIntent(
    externalId: string,
    paymentMethodId?: string
  ): Promise<CapturePaymentResult> {
    // M-PESA payments are confirmed via callback
    // This method queries the status
    const accessToken = await this.getAccessToken();
    const { password, timestamp } = this.generatePassword();

    const queryRequest = {
      BusinessShortCode: this.config.shortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: externalId
    };

    const response = await fetch(
      `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryRequest)
      }
    );

    const data = await response.json() as {
      ResultCode?: string;
      ResultDesc?: string;
    };

    const status = data.ResultCode === '0' ? 'SUCCEEDED' :
                   data.ResultCode === '1032' ? 'CANCELLED' :  // User cancelled
                   'FAILED';

    return {
      externalId,
      status: status as PaymentStatus,
      failureReason: status !== 'SUCCEEDED' ? data.ResultDesc : undefined,
      paidAt: status === 'SUCCEEDED' ? new Date() : undefined
    };
  }

  async cancelPaymentIntent(externalId: string, reason?: string): Promise<void> {
    // M-PESA STK Push cannot be cancelled once initiated
    // It times out automatically after ~1 minute
    logger.warn(`M-PESA payment ${externalId} cannot be cancelled - will timeout`);
  }

  async getPaymentIntentStatus(
    externalId: string
  ): Promise<{ status: PaymentStatus; metadata?: Record<string, unknown> }> {
    const result = await this.confirmPaymentIntent(externalId);
    return {
      status: result.status,
      metadata: { failureReason: result.failureReason }
    };
  }

  async refundPayment(params: {
    paymentIntentExternalId: string;
    amount?: Money;
    reason?: string;
    metadata?: Record<string, string>;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    // M-PESA refunds are done via B2C (Business to Customer)
    // This requires separate registration and approval
    throw new Error('M-PESA refunds require B2C API setup - contact support');
  }

  async createTransfer(params: {
    amount: Money;
    destination: string;  // Phone number
    description?: string;
    metadata?: Record<string, string>;
    idempotencyKey: string;
  }): Promise<TransferResult> {
    // B2C (Business to Customer) transfer
    // Requires separate API credentials and approval from Safaricom
    const accessToken = await this.getAccessToken();

    // Clean phone number
    let phoneNumber = params.destination.replace(/[^0-9]/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '254' + phoneNumber.substring(1);
    }

    // Build the SecurityCredential from the initiator password. Daraja
    // rejects B2C calls without a properly RSA-encrypted credential,
    // so an explicit failure here is preferable to sending a broken
    // request and interpreting the generic auth error downstream.
    const initiatorPassword =
      (params.metadata?.initiatorPassword as string | undefined) ??
      process.env.MPESA_INITIATOR_PASSWORD?.trim() ??
      '';
    if (!initiatorPassword) {
      throw new Error(
        'MPESA_INITIATOR_PASSWORD is required for B2C disbursement. ' +
          'Configure the initiator password in env or pass via metadata.initiatorPassword.'
      );
    }
    const securityCredential = buildSecurityCredential(
      initiatorPassword,
      (this.config.environment ?? 'sandbox') as 'sandbox' | 'production'
    );

    const b2cRequest = {
      InitiatorName: params.metadata?.initiator || 'BOSSNYUMBA',
      SecurityCredential: securityCredential,
      CommandID: 'BusinessPayment',
      Amount: Math.round(params.amount.amountMajorUnits),
      PartyA: this.config.shortCode,
      PartyB: phoneNumber,
      Remarks: params.description?.substring(0, 100) || 'Disbursement',
      QueueTimeOutURL: `${this.config.callbackBaseUrl}/webhooks/mpesa/b2c/timeout`,
      ResultURL: `${this.config.callbackBaseUrl}/webhooks/mpesa/b2c/result`,
      Occasion: params.metadata?.occasion || ''
    };

    const response = await fetch(
      `${this.baseUrl}/mpesa/b2c/v1/paymentrequest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(b2cRequest)
      }
    );

    const data = await response.json() as {
      ConversationID?: string;
      OriginatorConversationID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
    };

    if (!response.ok || data.ResponseCode !== '0') {
      throw new Error(`M-PESA B2C failed: ${data.ResponseDescription}`);
    }

    // Real PENDING with the Daraja ConversationID mapped as the transferId.
    // The authoritative delivery outcome arrives asynchronously at
    // /webhooks/mpesa/b2c/result (success → PAID) or /webhooks/mpesa/b2c/timeout
    // (no result → NEEDS_REVERSAL), keyed on this ConversationID. The
    // disbursement row is the source of truth from there on.
    return {
      transferId: data.ConversationID!,
      status: 'PENDING',
      amount: params.amount
    };
  }

  /**
   * M-Pesa B2C is a CALLBACK-ONLY rail: Safaricom delivers the authoritative
   * transfer outcome asynchronously to the ResultURL / QueueTimeOutURL
   * (handled by /webhooks/mpesa/b2c/{result,timeout}, which update the
   * disbursement row directly). There is NO synchronous "is this transfer
   * delivered yet?" query — even the Daraja Transaction Status API returns its
   * answer via a callback, not inline.
   *
   * We therefore throw a typed, explicit signal rather than guessing. The
   * disbursement-reconciliation sweep CATCHES this throw and, for a B2C
   * disbursement it cannot confirm here, leaves it NEEDS_REVERSAL + flags it
   * LOUD (never blind-reverses, never blind-re-sends) — the safe money
   * behaviour. The callbacks, not a poll, drive the terminal transition.
   */
  async getTransferStatus(transferId: string): Promise<TransferResult> {
    throw new MpesaCallbackOnlyStatusError(transferId);
  }

  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<ProviderPaymentMethod> {
    // For M-PESA, payment method is just the phone number
    return {
      externalId: paymentMethodId,
      type: 'mobile_money',
      last4: paymentMethodId.slice(-4),
      isDefault: true
    };
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    // No-op for M-PESA
  }

  async listPaymentMethods(customerId: string): Promise<ProviderPaymentMethod[]> {
    // Would need to query from our database
    return [];
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void> {
    // Would need to update in our database
  }

  async createConnectedAccount(params: {
    email: string;
    country: string;
    businessType?: 'individual' | 'company';
    metadata?: Record<string, string>;
  }): Promise<ConnectedAccount> {
    // M-PESA doesn't have connected accounts like Stripe
    // Payouts go directly to phone numbers
    throw new Error('M-PESA does not support connected accounts');
  }

  async getConnectedAccount(accountId: string): Promise<ConnectedAccount | null> {
    return null;
  }

  async createAccountLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<string> {
    throw new Error('M-PESA does not support account links');
  }

  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): boolean {
    // Robustness fix (Audit 2026-05-30, DIM-D D6 — security depth):
    // The previous implementation returned `true` unconditionally so any
    // future caller wiring this provider into a webhook receiver would
    // silently bypass authentication. The production M-Pesa receiver
    // lives in `services/payments-ledger/src/server.ts` and is guarded
    // by `mpesaSignatureMiddleware` (IP allowlist + HMAC + replay
    // window), so this method is currently dead code. Fix it to fail
    // closed so a future direct caller cannot accept an unsigned
    // payload by accident.
    //
    // Verify the HMAC-SHA256(secret, payload) scheme used by the
    // middleware, using timingSafeEqual to defeat timing side-channels
    // per ~/.claude/rules/security.md. Carbon-copy of Borjie fix #182
    // (commit 9facfc79).
    if (!webhookSecret || !signature) {
      logger.warn('M-PESA verifyWebhookSignature called without secret/signature — refusing');
      return false;
    }
    const raw =
      typeof payload === 'string'
        ? payload
        : Buffer.isBuffer(payload)
          ? payload.toString('utf8')
          : '';
    if (raw.length === 0) return false;
    try {
      const expected = createHmac('sha256', webhookSecret).update(raw).digest('hex');
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(signature, 'hex');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  parseWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): ProviderWebhookEvent {
    const data = JSON.parse(payload.toString());
    
    // Determine event type from callback structure
    let eventType = 'unknown';
    if (data.Body?.stkCallback) {
      eventType = 'stk_callback';
    } else if (data.Result) {
      eventType = 'b2c_result';
    }

    return {
      id: data.Body?.stkCallback?.CheckoutRequestID || 
          data.Result?.ConversationID ||
          `mpesa_${Date.now()}`,
      type: eventType,
      provider: this.name,
      data,
      timestamp: new Date()
    };
  }

  async getBalance(): Promise<{ available: Money[]; pending: Money[] }> {
    // Would need to implement account balance query
    // Requires separate API endpoint and credentials
    return {
      available: [],
      pending: []
    };
  }
}
