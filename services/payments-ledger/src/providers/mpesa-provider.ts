/**
 * M-PESA Payment Provider Implementation
 * Implements the payment provider interface for Safaricom M-PESA (Daraja API).
 */
import { createHmac, timingSafeEqual } from 'crypto';
import {
  Money,
  PaymentStatus,
  TenantId,
  CustomerId,
  CurrencyCode
} from '@bossnyumba/domain-models';
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

export interface MpesaProviderConfig {
  consumerKey: string;
  consumerSecret: string;
  shortCode: string;
  passKey: string;
  environment: 'sandbox' | 'production';
  callbackBaseUrl: string;
  /** Optional initiator name for B2C/balance/status queries */
  initiatorName?: string;
  /** Optional RSA-encrypted initiator password (SecurityCredential) */
  securityCredential?: string;
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
    
    this.token = {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + parseInt(data.expires_in) * 1000 - 60000)
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
      Amount: Math.round(params.amount.amountMajorUnits), // M-PESA uses whole units
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
    console.warn(`M-PESA payment ${externalId} cannot be cancelled - will timeout`);
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
    // M-PESA refunds use the Reversal API (TransactionReversal).
    // Requires initiator credentials. The receiver phone number must be
    // supplied in metadata (receiverPhone) since a reversal sends funds
    // back to the original payer and Daraja does not lookup that number.
    if (!this.config.initiatorName || !this.config.securityCredential) {
      throw new Error(
        'M-PESA refund requires initiatorName + securityCredential configuration'
      );
    }
    const receiverPhone = params.metadata?.receiverPhone;
    if (!receiverPhone) {
      throw new Error('M-PESA refund requires metadata.receiverPhone');
    }
    if (!params.amount) {
      throw new Error('M-PESA refund requires an amount');
    }
    const accessToken = await this.getAccessToken();
    const body = {
      Initiator: this.config.initiatorName,
      SecurityCredential: this.config.securityCredential,
      CommandID: 'TransactionReversal',
      TransactionID: params.paymentIntentExternalId,
      Amount: Math.round(params.amount.amountMajorUnits),
      ReceiverParty: receiverPhone,
      RecieverIdentifierType: '4',
      ResultURL: `${this.config.callbackBaseUrl}/webhooks/mpesa/reversal/result`,
      QueueTimeOutURL: `${this.config.callbackBaseUrl}/webhooks/mpesa/reversal/timeout`,
      Remarks: (params.reason ?? 'Refund').substring(0, 100),
      Occasion: ''
    };

    const response = await fetch(
      `${this.baseUrl}/mpesa/reversal/v1/request`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    const data = await response.json() as {
      ConversationID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
    };
    if (!response.ok || data.ResponseCode !== '0') {
      return {
        refundId: '',
        status: 'FAILED',
        amount: params.amount,
        failureReason: data.ResponseDescription || response.statusText
      };
    }
    return {
      refundId: data.ConversationID!,
      status: 'PENDING',
      amount: params.amount
    };
  }

  async createTransfer(params: {
    amount: Money;
    destination: string;  // Phone number
    description?: string;
    metadata?: Record<string, string>;
    idempotencyKey: string;
  }): Promise<TransferResult> {
    // B2C (Business to Customer) transfer. Requires initiatorName and a
    // valid (RSA-encrypted) securityCredential provisioned in Daraja.
    if (!this.config.initiatorName || !this.config.securityCredential) {
      throw new Error(
        'M-PESA B2C requires initiatorName + securityCredential configuration'
      );
    }
    const accessToken = await this.getAccessToken();

    // Clean phone number
    let phoneNumber = params.destination.replace(/[^0-9]/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '254' + phoneNumber.substring(1);
    }

    const b2cRequest = {
      InitiatorName: this.config.initiatorName,
      SecurityCredential: this.config.securityCredential,
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

    return {
      transferId: data.ConversationID!,
      status: 'PENDING',
      amount: params.amount
    };
  }

  async getTransferStatus(transferId: string): Promise<TransferResult> {
    // B2C status is received via callback
    // Would need to query from our database
    throw new Error('M-PESA transfer status must be tracked via callbacks');
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
    // Daraja itself does not sign callbacks — the accepted production pattern
    // is a pre-shared HMAC-SHA256 secret placed on the callback URL (via a
    // reverse proxy / API gateway) and verified here. If no secret is
    // configured, reject by default to fail-closed.
    if (!webhookSecret) {
      return false;
    }
    if (!signature) {
      return false;
    }
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const expectedHex = createHmac('sha256', webhookSecret).update(body).digest('hex');
    const provided = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature;
    if (provided.length !== expectedHex.length) return false;
    try {
      return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expectedHex, 'hex'));
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
    // AccountBalance is an asynchronous Daraja endpoint — the response is
    // delivered on the ResultURL callback, not inline. This method initiates
    // the query; downstream consumers should subscribe to the result webhook
    // to obtain the actual balances.
    if (!this.config.initiatorName || !this.config.securityCredential) {
      return { available: [], pending: [] };
    }
    const accessToken = await this.getAccessToken();
    const body = {
      Initiator: this.config.initiatorName,
      SecurityCredential: this.config.securityCredential,
      CommandID: 'AccountBalance',
      PartyA: this.config.shortCode,
      IdentifierType: '4',
      Remarks: 'Balance query',
      QueueTimeOutURL: `${this.config.callbackBaseUrl}/webhooks/mpesa/balance/timeout`,
      ResultURL: `${this.config.callbackBaseUrl}/webhooks/mpesa/balance/result`
    };
    try {
      await fetch(`${this.baseUrl}/mpesa/accountbalance/v1/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    } catch {
      // Swallow — balance is advisory. Errors are surfaced via logs upstream.
    }
    // No inline balance available; subscribe to webhook for the value.
    return { available: [], pending: [] };
  }
}
