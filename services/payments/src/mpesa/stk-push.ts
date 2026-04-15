import axios, { AxiosInstance, AxiosError } from 'axios';
import { createPublicKey, publicEncrypt, constants as cryptoConstants } from 'node:crypto';
import { z } from 'zod';

export interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  callbackUrl: string;
  environment: 'sandbox' | 'production';
  /**
   * Daraja "security credential" is the base64 PKCS#1.5-encrypted initiator
   * password. Either provide it pre-encrypted, or provide the initiator name
   * and plaintext password together with the Safaricom-issued public
   * certificate so this class can encrypt it on demand.
   */
  securityCredential?: string;
  initiatorName?: string;
  initiatorPassword?: string;
  /** PEM-encoded Safaricom public certificate (sandbox or production). */
  publicCertificatePem?: string;
}

/** zod schema for a validated STK Push input. */
export const StkPushRequestSchema = z.object({
  phoneNumber: z
    .string()
    .min(9)
    .max(15)
    .regex(/^[+\d\s()-]+$/, 'phoneNumber must contain only digits, spaces, "+", "-" or "()"'),
  amount: z
    .number()
    .finite()
    .positive()
    .int({ message: 'M-Pesa STK amounts are whole KES shillings' })
    .max(150000, 'Safaricom STK Push caps a single transaction at KES 150,000'),
  accountReference: z
    .string()
    .min(1, 'accountReference is required')
    .max(12, 'accountReference must be <= 12 characters'),
  transactionDesc: z
    .string()
    .min(1)
    .max(13, 'transactionDesc must be <= 13 characters')
    .optional(),
});

export type StkPushRequest = z.infer<typeof StkPushRequestSchema>;

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface StkQueryRequest {
  checkoutRequestId: string;
}

export interface StkQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

const SANDBOX_URL = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_URL = 'https://api.safaricom.co.ke';

export class MpesaStkPush {
  private config: MpesaConfig;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config?: Partial<MpesaConfig>) {
    this.config = {
      consumerKey: config?.consumerKey || process.env.MPESA_CONSUMER_KEY || '',
      consumerSecret: config?.consumerSecret || process.env.MPESA_CONSUMER_SECRET || '',
      passkey: config?.passkey || process.env.MPESA_PASSKEY || '',
      shortcode: config?.shortcode || process.env.MPESA_SHORTCODE || '',
      callbackUrl: config?.callbackUrl || process.env.MPESA_CALLBACK_URL || '',
      environment: (config?.environment || process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      securityCredential: config?.securityCredential || process.env.MPESA_SECURITY_CREDENTIAL,
      initiatorName: config?.initiatorName || process.env.MPESA_INITIATOR_NAME,
      initiatorPassword: config?.initiatorPassword || process.env.MPESA_INITIATOR_PASSWORD,
      publicCertificatePem: config?.publicCertificatePem || process.env.MPESA_PUBLIC_CERT_PEM,
    };

    const baseURL = this.config.environment === 'production' ? PRODUCTION_URL : SANDBOX_URL;

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get OAuth access token from M-Pesa
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');

    const response = await this.client.get('/oauth/v1/generate?grant_type=client_credentials', {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    this.accessToken = response.data.access_token;
    // Token expires in 1 hour, but we refresh 5 minutes early
    this.tokenExpiry = Date.now() + 55 * 60 * 1000;

    return this.accessToken!;
  }

  /**
   * Generate password for STK push
   */
  private generatePassword(): { password: string; timestamp: string } {
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);

    const password = Buffer.from(`${this.config.shortcode}${this.config.passkey}${timestamp}`).toString('base64');

    return { password, timestamp };
  }

  /**
   * Format phone number to M-Pesa format (254XXXXXXXXX)
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Handle different formats
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.slice(1);
    } else if (cleaned.startsWith('+254')) {
      cleaned = cleaned.slice(1);
    } else if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }

    return cleaned;
  }

  /**
   * Initiate STK Push payment request.
   *
   * Input is validated via `StkPushRequestSchema` before any network call.
   * The returned `CheckoutRequestID` is the idempotency key the caller should
   * persist and use when polling `queryStkPushStatus` or matching callbacks.
   */
  async initiateStkPush(request: StkPushRequest): Promise<StkPushResponse> {
    const parsed = StkPushRequestSchema.parse(request);
    this.assertConfigured();

    const accessToken = await this.getAccessToken();
    const { password, timestamp } = this.generatePassword();
    const phoneNumber = this.formatPhoneNumber(parsed.phoneNumber);

    const payload = {
      BusinessShortCode: this.config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(parsed.amount),
      PartyA: phoneNumber,
      PartyB: this.config.shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: this.config.callbackUrl,
      AccountReference: parsed.accountReference, // already validated <= 12
      TransactionDesc: parsed.transactionDesc ?? 'Payment',
    };

    try {
      const response = await this.client.post<StkPushResponse>(
        '/mpesa/stkpush/v1/processrequest',
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.data?.CheckoutRequestID) {
        throw new Error(
          `M-Pesa STK Push returned unexpected response: ${JSON.stringify(response.data)}`
        );
      }
      return response.data;
    } catch (error) {
      throw wrapDarajaError('stkpush', error);
    }
  }

  /**
   * Query STK Push transaction status
   */
  async queryStkPushStatus(request: StkQueryRequest): Promise<StkQueryResponse> {
    if (!request.checkoutRequestId) {
      throw new Error('checkoutRequestId is required');
    }
    this.assertConfigured();

    const accessToken = await this.getAccessToken();
    const { password, timestamp } = this.generatePassword();

    const payload = {
      BusinessShortCode: this.config.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: request.checkoutRequestId,
    };

    try {
      const response = await this.client.post<StkQueryResponse>(
        '/mpesa/stkpushquery/v1/query',
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return response.data;
    } catch (error) {
      throw wrapDarajaError('stkpushquery', error);
    }
  }

  /**
   * Compute the Daraja "security credential" expected by B2C / reversal /
   * account-balance endpoints. If a pre-computed credential is configured on
   * the client it is returned as-is, otherwise the initiator password is
   * RSA/PKCS1 v1.5 encrypted with the Safaricom public certificate and the
   * result is base64-encoded (matching the Java sample Safaricom publishes).
   */
  getSecurityCredential(): string {
    if (this.config.securityCredential) {
      return this.config.securityCredential;
    }
    const { initiatorPassword, publicCertificatePem } = this.config;
    if (!initiatorPassword || !publicCertificatePem) {
      throw new Error(
        'M-Pesa security credential cannot be derived: provide either `securityCredential` directly, or both `initiatorPassword` and `publicCertificatePem`.'
      );
    }
    const publicKey = createPublicKey({ key: publicCertificatePem, format: 'pem' });
    const encrypted = publicEncrypt(
      { key: publicKey, padding: cryptoConstants.RSA_PKCS1_PADDING },
      Buffer.from(initiatorPassword, 'utf8')
    );
    return encrypted.toString('base64');
  }

  /**
   * Assert the minimum configuration necessary to talk to Daraja is in place.
   */
  private assertConfigured(): void {
    const missing: string[] = [];
    if (!this.config.consumerKey) missing.push('consumerKey');
    if (!this.config.consumerSecret) missing.push('consumerSecret');
    if (!this.config.passkey) missing.push('passkey');
    if (!this.config.shortcode) missing.push('shortcode');
    if (!this.config.callbackUrl) missing.push('callbackUrl');
    if (missing.length > 0) {
      throw new Error(`M-Pesa client missing required config: ${missing.join(', ')}`);
    }
  }

  /**
   * Initiate payment for rent
   */
  async initiateRentPayment(
    phoneNumber: string,
    amount: number,
    invoiceId: string,
    propertyName?: string
  ): Promise<StkPushResponse> {
    return this.initiateStkPush({
      phoneNumber,
      amount,
      // Daraja caps account reference at 12 characters; truncate defensively.
      accountReference: invoiceId.slice(0, 12),
      transactionDesc: propertyName ? `Rent-${propertyName}`.slice(0, 13) : 'RentPayment',
    });
  }

  /**
   * Check if STK Push was successful based on result code
   */
  isSuccessful(resultCode: string): boolean {
    return resultCode === '0';
  }

  /**
   * Get human-readable error message for result code
   */
  getResultMessage(resultCode: string): string {
    const messages: Record<string, string> = {
      '0': 'Transaction successful',
      '1': 'Insufficient balance / insufficient funds',
      '1032': 'Transaction cancelled by user',
      '1037': 'Timeout waiting for user input',
      '2001': 'Wrong PIN entered',
    };

    return messages[resultCode] || `Unknown error (code: ${resultCode})`;
  }
}

export const mpesaStkPush = new MpesaStkPush();

/**
 * Normalize Daraja HTTP errors into a single Error with a useful message.
 * Daraja returns JSON bodies like `{ errorCode, errorMessage, requestId }`.
 */
export class DarajaError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly httpStatus?: number,
    public readonly errorCode?: string,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = 'DarajaError';
  }
}

function wrapDarajaError(endpoint: string, error: unknown): DarajaError {
  if ((error as AxiosError)?.isAxiosError) {
    const axErr = error as AxiosError<{ errorCode?: string; errorMessage?: string; requestId?: string }>;
    const data = axErr.response?.data;
    const message = data?.errorMessage || axErr.message || 'M-Pesa request failed';
    return new DarajaError(
      `Daraja ${endpoint} failed: ${message}`,
      endpoint,
      axErr.response?.status,
      data?.errorCode,
      data?.requestId
    );
  }
  if (error instanceof Error) {
    return new DarajaError(`Daraja ${endpoint} failed: ${error.message}`, endpoint);
  }
  return new DarajaError(`Daraja ${endpoint} failed: ${String(error)}`, endpoint);
}
