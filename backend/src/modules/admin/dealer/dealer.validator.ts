import { z } from 'zod';

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);

const dealerStatusSchema = z.enum(['active', 'inactive']);
const formStatusSchema = z.enum(['draft', 'pending', 'approved', 'rejected', 'hold']);
const verificationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'hold']);

const optionalString = z.string().trim().optional().default('');

const dealerCoreSchema = z.object({
  id: z.string().trim().min(1).optional(),
  creatorType: optionalString,
  creatorId: optionalString,
  creatorName: optionalString,
  dealerCode: nonEmpty('Dealer Code'),
  dealerName: nonEmpty('Firm / Shop Name'),
  ownerName: optionalString,
  businessType: optionalString,
  mobile: optionalString,
  whatsapp: optionalString,
  email: optionalString,
  dealerType: optionalString,
  categoryDepartment: optionalString,
  establishedYear: optionalString,
  shopAddress: optionalString,
  pincode: optionalString,
  googleLocation: optionalString,
  deliveryArea: optionalString,
  deliveryTime: optionalString,
  warehouseAddress: optionalString,
  panCard: optionalString,
  gstCertificate: optionalString,
  ownerAadhaar: optionalString,
  shopAddressProof: optionalString,
  cancelledCheque: optionalString,
  shopPhotos: optionalString,
  accountHolderName: optionalString,
  accountNumber: optionalString,
  ifscCode: optionalString,
  paymentCycle: optionalString,
  holdPercentage: optionalString,
  productDeliveryBy: optionalString,
  assignedB2BManager: optionalString,
  verificationStatus: verificationStatusSchema.optional().default('pending'),
  dealerAgreement: optionalString,
  status: dealerStatusSchema.optional(),
  formStatus: formStatusSchema.optional(),
  dealer_address: optionalString,
  dealerMobile: optionalString,
  gstNumber: optionalString,
  branch: optionalString,
  paymentSchedule: optionalString,
  holdDays: z.coerce.number().int().min(0).optional().default(0),
  commission: z.coerce.number().min(0).optional().default(0),
  dealerBranch: optionalString,
  paymentSettlementTerms: optionalString,
  name: optionalString,
});

const requiredWhenNotDraft = [
  ['creatorType', 'Creator Type'],
  ['creatorName', 'Search Creator'],
  ['ownerName', 'Owner Name'],
  ['businessType', 'Business Type'],
  ['mobile', 'Mobile Number'],
  ['dealerType', 'Dealer Type'],
  ['categoryDepartment', 'Category / Department'],
  ['shopAddress', 'Complete Shop Address'],
  ['pincode', 'Pincode'],
  ['googleLocation', 'Google Location'],
  ['deliveryArea', 'Delivery Area'],
  ['panCard', 'PAN Card'],
  ['ownerAadhaar', 'Owner Aadhaar'],
  ['shopAddressProof', 'Shop Address Proof'],
  ['cancelledCheque', 'Cancelled Cheque'],
  ['shopPhotos', 'Shop Photos'],
  ['accountHolderName', 'Account Holder Name'],
  ['accountNumber', 'Account Number'],
  ['ifscCode', 'IFSC Code'],
  ['paymentCycle', 'Payment Cycle'],
  ['productDeliveryBy', 'Product Delivery By'],
  ['assignedB2BManager', 'Assigned B2B Manager'],
] as const;

const dealerBodySchema = dealerCoreSchema.superRefine((data, ctx) => {
  // Backward compatible with admin-app minimal dealer master CRUD (no full onboarding).
  const status = data.formStatus ?? 'draft';
  if (status === 'draft') return;
  for (const [key, label] of requiredWhenNotDraft) {
    const value = data[key as keyof typeof data];
    if (typeof value !== 'string' || !value.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} is required`,
        path: [key],
      });
    }
  }
});

/** POST /admin/dealers */
export const createDealerBodySchema = dealerBodySchema;

/** PUT /admin/dealers/:id */
export const updateDealerBodySchema = dealerBodySchema;

export type CreateDealerBody = z.infer<typeof createDealerBodySchema>;
export type UpdateDealerBody = z.infer<typeof updateDealerBodySchema>;
