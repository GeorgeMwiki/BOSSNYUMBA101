/**
 * GePG (Government Electronic Payment Gateway) Payment Provider
 * Tanzania government payment system using Control Numbers
 *
 * GePG is used by government entities like TRC for collecting payments.
 * Flow: Submit Bill → Receive Control Number → Customer pays via bank/mobile → GePG notifies callback
 */
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

// ============================================================================
// Configuration
// ============================================================================

export interface GepgProviderConfig {
  spCode: string;              // Service Provider Code (e.g., TRC's SP code)
  subSpCode: string;           // Sub Service Provider Code
  spSystemId: string;          // System ID registered with GePG
  apiUrl: string;              // GePG API endpoint
  signaturePrivateKey: string; // Private key for signing requests (PEM)
  gepgPublicKey: string;       // GePG public key for verifying responses (PEM)
  environment: 'sandbox' | 'production';
  callbackBaseUrl: string;     // Base URL for payment notifications
  currency: 'TZS';
}

// ============================================================================
// GePG-Specific Types
// ============================================================================

interface GepgBillRequest {
  billId: string;
  subSpCode: string;
  spSystemId: string;
  billAmount: number;
  miscAmount: number;
  billExpiryDate: string;    // YYYY-MM-DD'T'HH:mm:ss
  payerName: string;
  payerPhone: string;
  payerEmail: string;
  billDescription: string;
  currency: string;
  billEquivAmount: number;
  remFlag: boolean;
  paymentType: 'exact' | 'partial' | 'full';
  paymentOption: number;      // 1=full, 2=partial, 3=exact
}

interface GepgBillResponse {
  trxId: string;             // Transaction/Control Number
  billId: string;
  payControlNumber: string;  // The Control Number for payment
  status: string;
  statusDescription: string;
}

interface GepgPaymentNotification {
  trxId: string;
  billId: string;
  controlNumber: string;
  payRefId: string;          // Payment reference from bank
  paidAmount: number;
  billAmount: number;
  currency: string;
  payerName: string;
  payerPhone: string;
  pspName: string;           // Payment Service Provider (bank name)
  pspCode: string;
  trxDtTm: string;          // Transaction datetime
  receiptNumber: string;
}

// ============================================================================
// GePG Payment Provider
// ============================================================================

export class GepgPaymentProvider extends BasePaymentProvider {
  readonly name = 'gepg';
  readonly supportedCurrencies: CurrencyCode[] = ['TZS'];

  private config: GepgProviderConfig;
  private baseUrl: string;

  constructor(config: GepgProviderConfig) {
    super();
    this.config = config;
    this.baseUrl = config.apiUrl;
  }

  // =========================================================================
  // Bill Submission (Create Payment Intent → Submit Bill → Get Control Number)
  // =========================================================================

  /**
   * Submit a bill to GePG and receive a Control Number.
   * The Control Number is what the customer uses to pay at any bank or via mobile money.
   */
  async createPaymentIntent(params: {
    amount: Money;
    customerId: string;
    paymentMethodId?: string;
    description?: string;
    statementDescriptor?: string;
    metadata?: Record<string, string>;
    idempotencyKey: string;
    applicationFeeAmount?: Money;
    transferDestination?: string;
  }): Promise<CreatePaymentResult> {
    const billId = params.idempotencyKey;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30-day expiry

    const billRequest: GepgBillRequest = {
      billId,
      subSpCode: this.config.subSpCode,
      spSystemId: this.config.spSystemId,
      billAmount: params.amount.amount,
      miscAmount: 0,
      billExpiryDate: expiryDate.toISOString().replace('Z', ''),
      payerName: params.metadata?.payerName ?? 'Customer',
      payerPhone: params.metadata?.payerPhone ?? '',
      payerEmail: params.metadata?.payerEmail ?? '',
      billDescription: params.description ?? 'Rent Payment',
      currency: 'TZS',
      billEquivAmount: params.amount.amount,
      remFlag: true,
      paymentType: 'exact',
      paymentOption: 3,
    };

    const xmlPayload = this.buildBillSubmissionXml(billRequest);
    const signature = await this.signPayload(xmlPayload);

    const response = await fetch(`${this.baseUrl}/api/bill/sigqrequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Gepg-Com': this.config.spCode,
        'Gepg-Code': signature,
      },
      body: xmlPayload,
    });

    if (!response.ok) {
      throw new Error(`GePG bill submission failed: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    const billResponse = this.parseBillResponse(responseText);

    return {
      externalId: billResponse.payControlNumber, // Control Number is the external ID
      status: 'PENDING' as PaymentStatus,
      instructions: `Pay using Control Number: ${billResponse.payControlNumber}. You can pay at any bank, mobile money agent, or via mobile banking.`,
      expiresAt: expiryDate,
    };
  }

  /**
   * Check payment status for a Control Number.
   * GePG pushes notifications, but this allows pull-based status checks.
   */
  async confirmPaymentIntent(
    externalId: string, // Control Number
    _paymentMethodId?: string
  ): Promise<CapturePaymentResult> {
    const xmlPayload = this.buildPaymentStatusQueryXml(externalId);
    const signature = await this.signPayload(xmlPayload);

    const response = await fetch(`${this.baseUrl}/api/bill/sigpayment_status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Gepg-Com': this.config.spCode,
        'Gepg-Code': signature,
      },
      body: xmlPayload,
    });

    if (!response.ok) {
      return {
        externalId,
        status: 'PENDING' as PaymentStatus,
        failureReason: 'Unable to query payment status',
      };
    }

    const responseText = await response.text();
    const isPaid = responseText.includes('<PaymentStatus>PAID</PaymentStatus>');

    return {
      externalId,
      status: isPaid ? ('COMPLETED' as PaymentStatus) : ('PENDING' as PaymentStatus),
      paidAt: isPaid ? new Date() : undefined,
    };
  }

  /**
   * Cancel an unpaid bill/Control Number.
   */
  async cancelPaymentIntent(
    externalId: string, // Control Number
    reason?: string
  ): Promise<void> {
    const xmlPayload = this.buildBillCancellationXml(externalId, reason ?? 'Cancelled by system');
    const signature = await this.signPayload(xmlPayload);

    const response = await fetch(`${this.baseUrl}/api/bill/sigcancel_request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Gepg-Com': this.config.spCode,
        'Gepg-Code': signature,
      },
      body: xmlPayload,
    });

    if (!response.ok) {
      throw new Error(`GePG bill cancellation failed: ${response.status}`);
    }
  }

  /**
   * Query current payment status of a Control Number.
   */
  async getPaymentIntentStatus(
    externalId: string
  ): Promise<{ status: PaymentStatus; metadata?: Record<string, unknown> }> {
    const result = await this.confirmPaymentIntent(externalId);
    return {
      status: result.status,
      metadata: { controlNumber: externalId },
    };
  }

  // =========================================================================
  // Webhook Handling (GePG Payment Notifications)
  // =========================================================================

  /**
   * Verify GePG callback signature using their public key.
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    _webhookSecret: string
  ): boolean {
    try {
      const crypto = require('crypto');
      const verifier = crypto.createVerify('SHA256');
      verifier.update(typeof payload === 'string' ? payload : payload.toString());
      return verifier.verify(this.config.gepgPublicKey, signature, 'base64');
    } catch {
      return false;
    }
  }

  /**
   * Parse GePG payment notification callback.
   * Called when a customer completes payment.
   */
  parseWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): ProviderWebhookEvent {
    if (!this.verifyWebhookSignature(payload, signature, webhookSecret)) {
      throw new Error('Invalid GePG webhook signature');
    }

    const payloadStr = typeof payload === 'string' ? payload : payload.toString();
    const notification = this.parsePaymentNotification(payloadStr);

    return {
      id: notification.trxId,
      type: 'payment.completed',
      provider: 'gepg',
      data: {
        controlNumber: notification.controlNumber,
        billId: notification.billId,
        paidAmount: notification.paidAmount,
        billAmount: notification.billAmount,
        currency: notification.currency,
        payerName: notification.payerName,
        payerPhone: notification.payerPhone,
        bankName: notification.pspName,
        bankCode: notification.pspCode,
        receiptNumber: notification.receiptNumber,
        paymentReference: notification.payRefId,
      },
      timestamp: new Date(notification.trxDtTm),
    };
  }

  // =========================================================================
  // Customer Management (Minimal for GePG - government gateway)
  // =========================================================================

  async createCustomer(
    _tenantId: TenantId,
    customerId: CustomerId,
    _email: string,
    name?: string,
    metadata?: Record<string, string>
  ): Promise<ProviderCustomer> {
    // GePG doesn't have customer accounts; payer info is per-bill
    return {
      externalId: customerId,
      name,
      metadata,
    };
  }

  async getCustomer(externalCustomerId: string): Promise<ProviderCustomer | null> {
    return { externalId: externalCustomerId };
  }

  // =========================================================================
  // Not Supported by GePG (Government Payment Gateway)
  // =========================================================================

  async refundPayment(_params: {
    paymentIntentExternalId: string;
    amount?: Money;
    reason?: string;
    metadata?: Record<string, string>;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    throw new Error('GePG does not support refunds. Government refunds follow a separate administrative process.');
  }

  async createTransfer(_params: {
    amount: Money;
    destination: string;
    description?: string;
    metadata?: Record<string, string>;
    idempotencyKey: string;
  }): Promise<TransferResult> {
    throw new Error('GePG does not support outbound transfers. Use the government disbursement process.');
  }

  async getTransferStatus(_transferId: string): Promise<TransferResult> {
    throw new Error('GePG does not support transfer tracking.');
  }

  async attachPaymentMethod(
    _paymentMethodId: string,
    _customerId: string
  ): Promise<ProviderPaymentMethod> {
    throw new Error('GePG uses Control Numbers, not stored payment methods.');
  }

  async detachPaymentMethod(_paymentMethodId: string): Promise<void> {
    throw new Error('GePG uses Control Numbers, not stored payment methods.');
  }

  async listPaymentMethods(_customerId: string): Promise<ProviderPaymentMethod[]> {
    return []; // GePG has no stored payment methods
  }

  async setDefaultPaymentMethod(
    _customerId: string,
    _paymentMethodId: string
  ): Promise<void> {
    throw new Error('GePG uses Control Numbers, not stored payment methods.');
  }

  async createConnectedAccount(_params: {
    email: string;
    country: string;
    businessType?: 'individual' | 'company';
    metadata?: Record<string, string>;
  }): Promise<ConnectedAccount> {
    throw new Error('GePG does not support connected accounts.');
  }

  async getConnectedAccount(_accountId: string): Promise<ConnectedAccount | null> {
    throw new Error('GePG does not support connected accounts.');
  }

  async createAccountLink(
    _accountId: string,
    _returnUrl: string,
    _refreshUrl: string
  ): Promise<string> {
    throw new Error('GePG does not support account onboarding links.');
  }

  async getBalance(): Promise<{ available: Money[]; pending: Money[] }> {
    // GePG balance queries are done through the government treasury system
    return { available: [], pending: [] };
  }

  // =========================================================================
  // XML Builders (GePG uses SOAP/XML)
  // =========================================================================

  private buildBillSubmissionXml(bill: GepgBillRequest): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Gepg>
  <gepgBillSubReq>
    <BillHdr>
      <SpCode>${this.config.spCode}</SpCode>
      <RtrRespFlg>true</RtrRespFlg>
    </BillHdr>
    <BillTrxInf>
      <BillId>${bill.billId}</BillId>
      <SubSpCode>${bill.subSpCode}</SubSpCode>
      <SpSysId>${bill.spSystemId}</SpSysId>
      <BillAmt>${bill.billAmount}</BillAmt>
      <MiscAmt>${bill.miscAmount}</MiscAmt>
      <BillExprDt>${bill.billExpiryDate}</BillExprDt>
      <PyrName>${this.escapeXml(bill.payerName)}</PyrName>
      <PyrCellNum>${bill.payerPhone}</PyrCellNum>
      <PyrEmail>${bill.payerEmail}</PyrEmail>
      <BillDesc>${this.escapeXml(bill.billDescription)}</BillDesc>
      <Ccy>${bill.currency}</Ccy>
      <BillEqvAmt>${bill.billEquivAmount}</BillEqvAmt>
      <RemFlag>${bill.remFlag}</RemFlag>
      <BillPayOpt>${bill.paymentOption}</BillPayOpt>
    </BillTrxInf>
  </gepgBillSubReq>
</Gepg>`;
  }

  private buildPaymentStatusQueryXml(controlNumber: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Gepg>
  <gepgBillSubReq>
    <SpCode>${this.config.spCode}</SpCode>
    <PayControlNum>${controlNumber}</PayControlNum>
  </gepgBillSubReq>
</Gepg>`;
  }

  private buildBillCancellationXml(controlNumber: string, reason: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Gepg>
  <gepgBillCanclReq>
    <SpCode>${this.config.spCode}</SpCode>
    <SpSysId>${this.config.spSystemId}</SpSysId>
    <PayControlNum>${controlNumber}</PayControlNum>
    <CancelReason>${this.escapeXml(reason)}</CancelReason>
  </gepgBillCanclReq>
</Gepg>`;
  }

  // =========================================================================
  // XML Parsers
  // =========================================================================

  private parseBillResponse(xml: string): GepgBillResponse {
    const extract = (tag: string): string => {
      const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
      return match ? match[1] : '';
    };

    return {
      trxId: extract('TrxId'),
      billId: extract('BillId'),
      payControlNumber: extract('PayCntrNum') || extract('PayControlNum'),
      status: extract('TrxStsCode') || extract('Status'),
      statusDescription: extract('TrxStsDesc') || extract('StatusDesc'),
    };
  }

  private parsePaymentNotification(xml: string): GepgPaymentNotification {
    const extract = (tag: string): string => {
      const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
      return match ? match[1] : '';
    };

    return {
      trxId: extract('TrxId'),
      billId: extract('BillId'),
      controlNumber: extract('PayCntrNum') || extract('ControlNumber'),
      payRefId: extract('PayRefId'),
      paidAmount: parseFloat(extract('PaidAmt') || '0'),
      billAmount: parseFloat(extract('BillAmt') || '0'),
      currency: extract('CCy') || 'TZS',
      payerName: extract('PyrName'),
      payerPhone: extract('PyrCellNum'),
      pspName: extract('PspName'),
      pspCode: extract('PspCode'),
      trxDtTm: extract('TrxDtTm'),
      receiptNumber: extract('CtrAccNum') || extract('ReceiptNum'),
    };
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async signPayload(payload: string): Promise<string> {
    const crypto = require('crypto');
    const signer = crypto.createSign('SHA256');
    signer.update(payload);
    return signer.sign(this.config.signaturePrivateKey, 'base64');
  }
}
