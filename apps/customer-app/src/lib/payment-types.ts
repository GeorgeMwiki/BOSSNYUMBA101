export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'processing' | 'failed';

export type PaymentType = 'rent' | 'utilities' | 'deposit' | 'late_fee' | 'other';

export interface Payment {
  id: string;
  type: PaymentType;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
  paidDate?: string;
  reference?: string;
  channel?: string;
}

export interface PaymentRecord {
  id: string;
  paymentNumber?: string;
  description?: string;
  amount: number;
  currency: string;
  status: string;
  completedAt?: string;
  createdAt?: string;
}

export interface BalanceBreakdown {
  description: string;
  amount: number;
  currency: string;
}

export interface PaymentBalance {
  totalDue: {
    amount: number;
    currency: string;
  };
  breakdown?: BalanceBreakdown[];
}
