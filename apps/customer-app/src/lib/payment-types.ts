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
