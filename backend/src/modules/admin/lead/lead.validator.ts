import { z } from 'zod';

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);
const optionalString = z.string().trim().optional().default('');

const leadStatusSchema = z.enum(['New', 'Contacted', 'Converted', 'Lost']).optional().default('New');

export const createLeadBodySchema = z.object({
  id: z.string().trim().min(1).optional(),
  customerName: nonEmpty('Customer Name'),
  customerMobile: nonEmpty('Customer Mobile'),
  interestedProduct: optionalString,
  notes: optionalString,
  status: leadStatusSchema,
  // Ownership fields are stripped server-side — accepted only to ignore client spoofing.
  creatorId: optionalString,
  dealerId: optionalString,
  agentId: optionalString,
});

export const updateLeadBodySchema = z.object({
  customerName: nonEmpty('Customer Name').optional(),
  customerMobile: nonEmpty('Customer Mobile').optional(),
  interestedProduct: optionalString,
  notes: optionalString,
  status: leadStatusSchema,
  creatorId: optionalString,
  dealerId: optionalString,
  agentId: optionalString,
});

export type CreateLeadBody = z.infer<typeof createLeadBodySchema>;
export type UpdateLeadBody = z.infer<typeof updateLeadBodySchema>;
