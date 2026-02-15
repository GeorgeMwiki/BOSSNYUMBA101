import { EventEmitter } from 'events';

export interface StkCallbackMetadataItem {
  Name: string;
  Value: string | number;
}

export interface StkCallbackBody {
  stkCallback: {
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResultCode: number;
    ResultDesc: string;
    CallbackMetadata?: {
      Item: StkCallbackMetadataItem[];
    };
  };
}

export interface ParsedStkCallback {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  success: boolean;
  amount?: number;
  mpesaReceiptNumber?: string;
  transactionDate?: Date;
  phoneNumber?: string;
}

export interface C2BConfirmation {
  TransactionType: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode: string;
  BillRefNumber: string;
  InvoiceNumber: string;
  OrgAccountBalance: string;
  ThirdPartyTransID: string;
  MSISDN: string;
  FirstName: string;
  MiddleName: string;
  LastName: string;
}

export interface ParsedC2BPayment {
  transactionId: string;
  transactionType: string;
  transactionTime: Date;
  amount: number;
  shortcode: string;
  accountReference: string;
  invoiceNumber: string;
  orgBalance: number;
  phoneNumber: string;
  customerName: string;
}

export type PaymentEventType = 'stk:success' | 'stk:failed' | 'stk:cancelled' | 'c2b:received';

export class MpesaCallbackHandler extends EventEmitter {
  private processedCallbacks: Set<string> = new Set();
  private readonly callbackTTL: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    super();
    // Clean up old processed callbacks periodically
    setInterval(() => this.cleanupProcessedCallbacks(), this.callbackTTL);
  }

  /**
   * Parse STK Push callback
   */
  parseStkCallback(body: StkCallbackBody): ParsedStkCallback {
    const { stkCallback } = body;

    const result: ParsedStkCallback = {
      merchantRequestId: stkCallback.MerchantRequestID,
      checkoutRequestId: stkCallback.CheckoutRequestID,
      resultCode: stkCallback.ResultCode,
      resultDesc: stkCallback.ResultDesc,
      success: stkCallback.ResultCode === 0,
    };

    // Extract metadata if present (only on success)
    if (stkCallback.CallbackMetadata?.Item) {
      for (const item of stkCallback.CallbackMetadata.Item) {
        switch (item.Name) {
          case 'Amount':
            result.amount = Number(item.Value);
            break;
          case 'MpesaReceiptNumber':
            result.mpesaReceiptNumber = String(item.Value);
            break;
          case 'TransactionDate':
            result.transactionDate = this.parseTransactionDate(String(item.Value));
            break;
          case 'PhoneNumber':
            result.phoneNumber = String(item.Value);
            break;
        }
      }
    }

    return result;
  }

  /**
   * Parse C2B confirmation callback
   */
  parseC2BConfirmation(body: C2BConfirmation): ParsedC2BPayment {
    return {
      transactionId: body.TransID,
      transactionType: body.TransactionType,
      transactionTime: this.parseTransactionDate(body.TransTime),
      amount: parseFloat(body.TransAmount),
      shortcode: body.BusinessShortCode,
      accountReference: body.BillRefNumber,
      invoiceNumber: body.InvoiceNumber,
      orgBalance: parseFloat(body.OrgAccountBalance),
      phoneNumber: body.MSISDN,
      customerName: [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(' '),
    };
  }

  /**
   * Parse M-Pesa transaction date format (YYYYMMDDHHmmss)
   */
  private parseTransactionDate(dateStr: string): Date {
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day = parseInt(dateStr.slice(6, 8));
    const hour = parseInt(dateStr.slice(8, 10));
    const minute = parseInt(dateStr.slice(10, 12));
    const second = parseInt(dateStr.slice(12, 14));

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Handle STK Push callback - main entry point for STK callbacks
   */
  async handleStkCallback(
    body: StkCallbackBody,
    onSuccess?: (data: ParsedStkCallback) => Promise<void>,
    onFailure?: (data: ParsedStkCallback) => Promise<void>
  ): Promise<{ success: boolean; message: string }> {
    const parsed = this.parseStkCallback(body);

    // Check for duplicate callback
    const callbackKey = `stk:${parsed.checkoutRequestId}`;
    if (this.processedCallbacks.has(callbackKey)) {
      return { success: true, message: 'Callback already processed' };
    }
    this.processedCallbacks.add(callbackKey);

    try {
      if (parsed.success) {
        this.emit('stk:success', parsed);
        if (onSuccess) {
          await onSuccess(parsed);
        }
        return { success: true, message: 'Payment processed successfully' };
      } else {
        // Determine failure type
        const eventType = parsed.resultCode === 1032 ? 'stk:cancelled' : 'stk:failed';
        this.emit(eventType, parsed);
        if (onFailure) {
          await onFailure(parsed);
        }
        return { success: false, message: parsed.resultDesc };
      }
    } catch (error) {
      // Re-add to queue for retry
      this.processedCallbacks.delete(callbackKey);
      throw error;
    }
  }

  /**
   * Handle C2B confirmation callback
   */
  async handleC2BConfirmation(
    body: C2BConfirmation,
    onReceived?: (data: ParsedC2BPayment) => Promise<void>
  ): Promise<{ success: boolean; message: string }> {
    const parsed = this.parseC2BConfirmation(body);

    // Check for duplicate
    const callbackKey = `c2b:${parsed.transactionId}`;
    if (this.processedCallbacks.has(callbackKey)) {
      return { success: true, message: 'Confirmation already processed' };
    }
    this.processedCallbacks.add(callbackKey);

    try {
      this.emit('c2b:received', parsed);
      if (onReceived) {
        await onReceived(parsed);
      }
      return { success: true, message: 'Confirmation received' };
    } catch (error) {
      this.processedCallbacks.delete(callbackKey);
      throw error;
    }
  }

  /**
   * Generate validation response for C2B
   */
  generateValidationResponse(accept: boolean, reason?: string): object {
    return {
      ResultCode: accept ? 0 : 1,
      ResultDesc: accept ? 'Accepted' : reason || 'Rejected',
    };
  }

  /**
   * Generate acknowledgment response for callbacks
   */
  generateAckResponse(): object {
    return {
      ResultCode: 0,
      ResultDesc: 'Success',
    };
  }

  /**
   * Clean up old processed callbacks
   */
  private cleanupProcessedCallbacks(): void {
    // For simplicity, just clear all - in production you'd track timestamps
    this.processedCallbacks.clear();
  }

  /**
   * Check if a callback was already processed
   */
  isProcessed(type: 'stk' | 'c2b', id: string): boolean {
    return this.processedCallbacks.has(`${type}:${id}`);
  }

  /**
   * Get error message for result code
   */
  getErrorMessage(resultCode: number): string {
    const errorMessages: Record<number, string> = {
      0: 'Success',
      1: 'Insufficient balance',
      1032: 'Request cancelled by user',
      1037: 'Timeout waiting for user input',
      2001: 'Wrong PIN entered',
      17: 'System busy, please try again',
    };

    return errorMessages[resultCode] || `Transaction failed with code ${resultCode}`;
  }
}

export const mpesaCallbackHandler = new MpesaCallbackHandler();
