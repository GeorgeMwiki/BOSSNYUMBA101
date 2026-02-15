import axios, { AxiosInstance } from 'axios';

export interface AfricasTalkingConfig {
  apiKey: string;
  username: string;
  environment: 'sandbox' | 'production';
  senderId?: string;
}

export interface SmsRequest {
  to: string | string[];
  message: string;
  from?: string;
  enqueue?: boolean;
  bulkSMSMode?: 0 | 1;
  retryDurationInHours?: number;
}

export interface SmsRecipient {
  statusCode: number;
  number: string;
  status: 'Success' | 'Sent' | 'Queued' | 'InvalidPhoneNumber' | 'InsufficientBalance' | string;
  cost: string;
  messageId: string;
}

export interface SmsResponse {
  SMSMessageData: {
    Message: string;
    Recipients: SmsRecipient[];
  };
}

export interface DeliveryReport {
  id: string;
  status: 'Success' | 'Failed' | 'Rejected' | 'Buffered' | 'Submitted';
  phoneNumber: string;
  networkCode?: string;
  failureReason?: string;
  retryCount?: number;
}

export interface BulkSmsRequest {
  recipients: Array<{
    phoneNumber: string;
    message: string;
  }>;
  from?: string;
}

const SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1';
const PRODUCTION_URL = 'https://api.africastalking.com/version1';

export class AfricasTalkingSms {
  private config: AfricasTalkingConfig;
  private client: AxiosInstance;

  constructor(config?: Partial<AfricasTalkingConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.AT_API_KEY || '',
      username: config?.username || process.env.AT_USERNAME || 'sandbox',
      environment: (config?.environment || process.env.AT_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      senderId: config?.senderId || process.env.AT_SENDER_ID,
    };

    const baseURL = this.config.environment === 'production' ? PRODUCTION_URL : SANDBOX_URL;

    this.client = axios.create({
      baseURL,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        apiKey: this.config.apiKey,
      },
    });
  }

  /**
   * Format phone number to international format
   */
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = '+254' + cleaned.slice(1); // Kenya default
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('254')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  /**
   * Format multiple phone numbers
   */
  private formatPhoneNumbers(phones: string | string[]): string {
    const phoneArray = Array.isArray(phones) ? phones : [phones];
    return phoneArray.map((p) => this.formatPhoneNumber(p)).join(',');
  }

  /**
   * Send SMS message(s)
   */
  async sendSms(request: SmsRequest): Promise<SmsResponse> {
    const params = new URLSearchParams();
    params.append('username', this.config.username);
    params.append('to', this.formatPhoneNumbers(request.to));
    params.append('message', request.message);

    if (request.from || this.config.senderId) {
      params.append('from', request.from || this.config.senderId!);
    }

    if (request.enqueue !== undefined) {
      params.append('enqueue', request.enqueue ? '1' : '0');
    }

    if (request.bulkSMSMode !== undefined) {
      params.append('bulkSMSMode', String(request.bulkSMSMode));
    }

    if (request.retryDurationInHours !== undefined) {
      params.append('retryDurationInHours', String(request.retryDurationInHours));
    }

    const response = await this.client.post<SmsResponse>('/messaging', params);
    return response.data;
  }

  /**
   * Send bulk personalized SMS
   */
  async sendBulkSms(request: BulkSmsRequest): Promise<SmsResponse[]> {
    const results: SmsResponse[] = [];

    // Africa's Talking doesn't support personalized bulk in single request
    // So we send individually but could batch for better performance
    for (const recipient of request.recipients) {
      const response = await this.sendSms({
        to: recipient.phoneNumber,
        message: recipient.message,
        from: request.from,
        enqueue: true, // Use enqueue for bulk
      });
      results.push(response);
    }

    return results;
  }

  /**
   * Send rent reminder SMS
   */
  async sendRentReminder(
    phoneNumber: string,
    tenantName: string,
    amount: number,
    dueDate: string,
    propertyName: string
  ): Promise<SmsResponse> {
    const message = `Dear ${tenantName}, this is a reminder that your rent of KES ${amount.toLocaleString()} for ${propertyName} is due on ${dueDate}. Please pay via M-Pesa Paybill. Thank you.`;

    return this.sendSms({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Send payment confirmation SMS
   */
  async sendPaymentConfirmation(
    phoneNumber: string,
    tenantName: string,
    amount: number,
    receiptNumber: string,
    balance: number
  ): Promise<SmsResponse> {
    const message =
      balance > 0
        ? `Dear ${tenantName}, we have received your payment of KES ${amount.toLocaleString()}. Receipt: ${receiptNumber}. Outstanding balance: KES ${balance.toLocaleString()}. Thank you.`
        : `Dear ${tenantName}, we have received your payment of KES ${amount.toLocaleString()}. Receipt: ${receiptNumber}. Your account is now fully paid. Thank you.`;

    return this.sendSms({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Send overdue notice SMS
   */
  async sendOverdueNotice(
    phoneNumber: string,
    tenantName: string,
    amount: number,
    daysOverdue: number,
    propertyName: string
  ): Promise<SmsResponse> {
    const message = `Dear ${tenantName}, your rent payment of KES ${amount.toLocaleString()} for ${propertyName} is ${daysOverdue} days overdue. Please pay immediately to avoid penalties. Contact us for any issues.`;

    return this.sendSms({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Send maintenance update SMS
   */
  async sendMaintenanceUpdate(
    phoneNumber: string,
    tenantName: string,
    ticketId: string,
    status: string
  ): Promise<SmsResponse> {
    const message = `Dear ${tenantName}, your maintenance request #${ticketId} status: ${status}. We will keep you updated on the progress.`;

    return this.sendSms({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Send lease expiry reminder
   */
  async sendLeaseExpiryReminder(
    phoneNumber: string,
    tenantName: string,
    expiryDate: string,
    daysRemaining: number
  ): Promise<SmsResponse> {
    const message = `Dear ${tenantName}, your lease agreement expires on ${expiryDate} (${daysRemaining} days remaining). Please contact us to discuss renewal options.`;

    return this.sendSms({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Send welcome message to new tenant
   */
  async sendWelcomeMessage(
    phoneNumber: string,
    tenantName: string,
    propertyName: string,
    unitNumber: string
  ): Promise<SmsResponse> {
    const message = `Welcome ${tenantName}! You are now registered at ${propertyName}, Unit ${unitNumber}. For any issues, please contact property management. Thank you for choosing us.`;

    return this.sendSms({
      to: phoneNumber,
      message,
    });
  }

  /**
   * Check account balance
   */
  async getBalance(): Promise<{ balance: string; currency: string }> {
    const params = new URLSearchParams();
    params.append('username', this.config.username);

    const response = await this.client.get('/user', { params: { username: this.config.username } });
    
    const balanceData = response.data?.UserData?.balance || '0';
    const [currency, balance] = balanceData.split(' ');
    
    return { balance, currency };
  }

  /**
   * Parse delivery report callback
   */
  parseDeliveryReport(body: Record<string, string>): DeliveryReport {
    return {
      id: body.id,
      status: body.status as DeliveryReport['status'],
      phoneNumber: body.phoneNumber,
      networkCode: body.networkCode,
      failureReason: body.failureReason,
      retryCount: body.retryCount ? parseInt(body.retryCount) : undefined,
    };
  }

  /**
   * Check if SMS was successfully sent
   */
  isSent(recipient: SmsRecipient): boolean {
    return ['Success', 'Sent', 'Queued'].includes(recipient.status);
  }

  /**
   * Get total cost from response
   */
  getTotalCost(response: SmsResponse): number {
    return response.SMSMessageData.Recipients.reduce((total, r) => {
      const cost = parseFloat(r.cost.replace(/[^0-9.]/g, ''));
      return total + (isNaN(cost) ? 0 : cost);
    }, 0);
  }
}

export const africasTalkingSms = new AfricasTalkingSms();
