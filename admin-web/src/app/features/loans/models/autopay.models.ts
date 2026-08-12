/** Mirrors backend autopayService mapMandate() — see autopay/service/autopay.service.ts. */
export interface AutopayMandate {
  id: string;
  provider: string;
  mandateId: string;
  mandateReference: string;
  paymentMethod: 'UPI_AUTOPAY' | 'EMANDATE' | 'NACH' | 'DEBIT_CARD' | string;
  bankName: string | null;
  upiId: string | null;
  maximumDebitAmount: number;
  frequency: string;
  nextDebitDate: string | null;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'FAILED' | string;
  failureReason: string | null;
  approvalUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutopayForLoan {
  loan: {
    id: string;
    loanAccountNumber: string;
    loanStatus: string;
    autopayEnabled: boolean;
    emiAmount: number;
    nextEmiDueDate: string | null;
  };
  mandates: AutopayMandate[];
  currentMandate: AutopayMandate | null;
}
