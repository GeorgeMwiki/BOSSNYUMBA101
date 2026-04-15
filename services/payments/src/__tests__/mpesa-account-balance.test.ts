import { describe, it, expect } from 'vitest';
import { parseAccountBalanceCallback } from '../providers/mpesa/account-balance';

describe('parseAccountBalanceCallback', () => {
  it('parses successful balance payload', () => {
    const payload = {
      Result: {
        ResultCode: 0,
        ResultDesc: 'Success',
        ConversationID: 'conv-1',
        ResultParameters: {
          ResultParameter: [
            {
              Key: 'AccountBalance',
              Value:
                'Working Account|KES|481000.00|481000.00|0.00|0.00&Utility Account|KES|1000.00|1000.00|0.00|0.00',
            },
          ],
        },
      },
    };
    const result = parseAccountBalanceCallback(payload);
    expect(result.status).toBe('SUCCEEDED');
    expect(result.balances.length).toBe(2);
    expect(result.balances[0]!.accountName).toBe('Working Account');
    expect(result.balances[0]!.availableBalance).toBe(481000);
    expect(result.balances[1]!.accountName).toBe('Utility Account');
  });

  it('parses failed payload', () => {
    const payload = {
      Result: {
        ResultCode: 17,
        ResultDesc: 'System busy',
        ConversationID: 'conv-2',
      },
    };
    const result = parseAccountBalanceCallback(payload);
    expect(result.status).toBe('FAILED');
    expect(result.resultCode).toBe(17);
    expect(result.balances).toEqual([]);
  });

  it('rejects malformed payloads', () => {
    expect(() => parseAccountBalanceCallback({})).toThrow();
  });
});
