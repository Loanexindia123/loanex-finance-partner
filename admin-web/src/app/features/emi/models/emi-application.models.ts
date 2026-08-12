/**
 * EMI Application list model — mirrors admin-app/src/types/emiApplication.ts
 * plus the optional fields mapped in admin-app/src/services/emiService.ts.
 */

export type EmiApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'hold';

export type EmiApplicationSort = 'date' | 'amount' | 'customer';

export interface EmiApplication {
  id: string;
  customerName: string;
  mobile: string;
  selectedProduct: string;
  requestedLoanAmount: number;
  emiPlan: string;
  applicationDate: string;
  status: EmiApplicationStatus;
  userId?: string;
  orderId?: string;
  productId?: string;
  emiPlanId?: string;
  totalAmount?: number;
  downPayment?: number;
  monthlyEmi?: number;
  tenure?: number;
  interestRate?: number;
  processingFee?: number;
  loanId?: string;
  loanAccountNumber?: string;
  loanStatus?: string;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const EMI_STATUS_FILTERS: { label: string; value: 'all' | EmiApplicationStatus }[] = [
  { label: 'All Applications', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Hold', value: 'hold' },
];

export const EMI_SORT_OPTIONS: { label: string; value: EmiApplicationSort }[] = [
  { label: 'Application Date — Newest', value: 'date' },
  { label: 'Loan Amount — High to Low', value: 'amount' },
  { label: 'Customer Name — A-Z', value: 'customer' },
];

export const EMI_STATUS_LABEL: Record<EmiApplicationStatus, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  hold: 'Hold',
};
