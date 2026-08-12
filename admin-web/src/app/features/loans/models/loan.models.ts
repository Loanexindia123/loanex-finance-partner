/** Mirrors backend buildLoanSummary()/getForAdmin() — see loan-payload.service.ts. */
export interface LoanScheduleRow {
  id: string;
  emiNumber: number;
  dueDate: string | null;
  principalAmount: number;
  interestAmount: number;
  emiAmount: number;
  remainingBalance: number;
  paymentStatus: 'PENDING' | 'PAID' | 'OVERDUE' | 'FAILED' | string;
  paidAt: string | null;
}

export interface LoanCustomer {
  id?: string;
  fullName?: string;
  mobile?: string;
  email?: string;
}

export interface LoanApplicationSummary {
  id: string;
  applicationNumber: string;
  status: string;
  productName?: string;
  adminRemarks?: string | null;
  rejectionReason?: string | null;
}

export interface LoanDetail {
  id: string;
  loanAccountNumber: string;
  applicationId?: string | null;
  applicationNumber?: string | null;
  productId?: string;
  productName?: string;
  productImage?: string;
  productPrice?: number;
  loanAmount: number;
  downPaymentPaid: number;
  processingFee: number;
  interestRate: number;
  loanTenure: number;
  emiAmount: number;
  totalInterest: number;
  totalPayable: number;
  outstandingAmount: number;
  paidAmount: number;
  nextEmiDueDate: string | null;
  lastPaymentDate: string | null;
  loanStatus: string;
  loanStartDate: string | null;
  loanEndDate: string | null;
  createdAt?: string;
  updatedAt?: string;
  customer: LoanCustomer | null;
  application: LoanApplicationSummary | null;
  schedule: LoanScheduleRow[];
}

/** Item from GET /admin/loans — see LoanService.listForAdmin() (buildLoanSummary + customer + applicationNumber). */
export interface LoanListItem {
  id: string;
  loanAccountNumber: string;
  applicationId?: string | null;
  applicationNumber?: string | null;
  productId?: string;
  productName?: string;
  loanAmount: number;
  interestRate: number;
  loanTenure: number;
  emiAmount: number;
  outstandingAmount: number;
  paidAmount: number;
  nextEmiDueDate: string | null;
  lastPaymentDate: string | null;
  loanStatus: string;
  loanStartDate: string | null;
  createdAt?: string;
  customer: LoanCustomer | null;
}

export type LoanStatusFilter = 'all' | 'ACTIVE' | 'CLOSED';

export const LOAN_STATUS_FILTERS: { label: string; value: LoanStatusFilter }[] = [
  { label: 'All Loans', value: 'all' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Closed', value: 'CLOSED' },
];

/** Item from GET /admin/emi-payments?loanId=:id */
export interface LoanPaymentRow {
  id: string;
  type: 'DOWN_PAYMENT' | 'EMI' | string;
  emiScheduleId: string | null;
  emiNumber: number | null;
  amount: number;
  paymentStatus: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function loanInstallmentsPaid(schedule: LoanScheduleRow[]): { paid: number; total: number } {
  const paid = schedule.filter((row) => row.paymentStatus === 'PAID').length;
  return { paid, total: schedule.length };
}

export function loanCompletionPercent(loan: Pick<LoanDetail, 'paidAmount' | 'totalPayable'>): number {
  if (!loan.totalPayable || loan.totalPayable <= 0) return 0;
  return Math.min(100, Math.round((loan.paidAmount / loan.totalPayable) * 100));
}
