/**
 * Integration tests for Payment endpoints
 *
 * POST /payments - record payment
 * POST /payments/mpesa - M-Pesa STK push (initiate)
 * POST /payments/mpesa/callback - M-Pesa callback webhook
 */

import { describe, it, expect } from 'vitest';
import {
  createTestAgent,
  BASE_PATH,
  getAuthToken,
  authHeader,
} from './setup';
import { DEMO_INVOICES, DEMO_CUSTOMERS } from '../data/mock-data';

const agent = createTestAgent();

// Use invoice with amount due (inv-002: 500000, inv-003: 2500000)
const invoiceWithDue = DEMO_INVOICES.find((i) => i.amountDue > 0);
const PAID_INVOICE = DEMO_INVOICES.find((i) => i.status === 'PAID');

describe('Payments API', () => {
  describe('POST /payments', () => {
    it('should record manual payment', async () => {
      const token = getAuthToken();
      const invoice = invoiceWithDue ?? DEMO_INVOICES[1];
      const amount = Math.min(100000, invoice.amountDue);

      const res = await agent
        .post(`${BASE_PATH}/payments`)
        .set(authHeader(token))
        .send({
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount,
          currency: 'TZS',
          method: 'CASH',
          reference: `TEST-${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.amount).toBe(amount);
      expect(res.body.data.method).toBe('CASH');
      expect(res.body.data.status).toBe('COMPLETED');
    });

    it('should return 404 for non-existent invoice', async () => {
      const token = getAuthToken();

      const res = await agent
        .post(`${BASE_PATH}/payments`)
        .set(authHeader(token))
        .send({
          invoiceId: 'inv-nonexistent',
          customerId: DEMO_CUSTOMERS[0].id,
          amount: 1000,
          currency: 'TZS',
          method: 'CASH',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when amount exceeds invoice amount due', async () => {
      const token = getAuthToken();
      const invoice = invoiceWithDue ?? DEMO_INVOICES[1];

      const res = await agent
        .post(`${BASE_PATH}/payments`)
        .set(authHeader(token))
        .send({
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: invoice.amountDue + 1000000,
          currency: 'TZS',
          method: 'BANK_TRANSFER',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('exceeds');
    });

    it('should return 401 without token', async () => {
      const res = await agent.post(`${BASE_PATH}/payments`).send({
        invoiceId: 'inv-001',
        customerId: 'customer-001',
        amount: 1000,
        currency: 'TZS',
        method: 'CASH',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /payments/mpesa', () => {
    it('should initiate M-Pesa STK push and return 202', async () => {
      const token = getAuthToken();
      const invoice = invoiceWithDue ?? DEMO_INVOICES[1];
      const amount = Math.min(50000, invoice.amountDue);

      const res = await agent
        .post(`${BASE_PATH}/payments/mpesa`)
        .set(authHeader(token))
        .send({
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount,
          phoneNumber: '+255755000099',
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkoutRequestId).toBeDefined();
      expect(res.body.data.paymentId).toBeDefined();
      expect(res.body.data.status).toBe('PENDING');
    });

    it('should return 404 for non-existent invoice', async () => {
      const token = getAuthToken();

      const res = await agent
        .post(`${BASE_PATH}/payments/mpesa`)
        .set(authHeader(token))
        .send({
          invoiceId: 'inv-nonexistent',
          customerId: 'customer-001',
          amount: 1000,
          phoneNumber: '+255755000099',
        });

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid phone format', async () => {
      const token = getAuthToken();
      const invoice = invoiceWithDue ?? DEMO_INVOICES[1];

      const res = await agent
        .post(`${BASE_PATH}/payments/mpesa`)
        .set(authHeader(token))
        .send({
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: 1000,
          phoneNumber: 'invalid-phone',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /payments/mpesa/callback', () => {
    it('should accept valid M-Pesa callback (success)', async () => {
      const callbackPayload = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'test-merchant-id',
            CheckoutRequestID: `ws_CO_${Date.now()}`,
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'MpesaReceiptNumber', Value: 'TEST123456' },
                { Name: 'Amount', Value: 1000 },
              ],
            },
          },
        },
      };

      const res = await agent
        .post(`${BASE_PATH}/payments/mpesa/callback`)
        .set('Content-Type', 'application/json')
        .send(callbackPayload);

      expect(res.status).toBe(200);
      expect(res.body.ResultCode).toBe(0);
    });

    it('should accept M-Pesa callback (user cancelled) and return 200', async () => {
      const callbackPayload = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'test-merchant-id',
            CheckoutRequestID: `ws_CO_${Date.now()}`,
            ResultCode: 1032,
            ResultDesc: ' Request cancelled by user',
          },
        },
      };

      const res = await agent
        .post(`${BASE_PATH}/payments/mpesa/callback`)
        .set('Content-Type', 'application/json')
        .send(callbackPayload);

      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid JSON body', async () => {
      const res = await agent
        .post(`${BASE_PATH}/payments/mpesa/callback`)
        .set('Content-Type', 'application/json')
        .send('not valid json');

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid callback structure', async () => {
      const res = await agent
        .post(`${BASE_PATH}/payments/mpesa/callback`)
        .set('Content-Type', 'application/json')
        .send({ invalid: 'structure' });

      expect(res.status).toBe(400);
    });
  });
});
