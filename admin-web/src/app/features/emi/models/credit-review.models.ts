export type CreditDecision =
  | 'Approved'
  | 'Rejected'
  | 'Hold'
  | 'Pending'
  | 'Documents Requested'
  | 'Alternate Product Recommended';

export interface CreditReview {
  applicationId: string;
  creditStatus: string;
  reviewer: string;
  reviewDate: string;
  remarks: string;
  decision: CreditDecision;
  kycStatus: string;
  aadhaarStatus: string;
  panStatus: string;
  bankingDetails: string;
  fiReport: string;
  emiEligibility: string;
  repaymentCapacity: string;
  selectedProduct: string;
  productMargin: string;
  downPayment: string;
  riskCategory: string;
  recommendedProduct?: string;
}
