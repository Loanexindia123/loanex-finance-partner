import { z } from 'zod';

const nonEmpty = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

const branchStatusSchema = z.enum(['active', 'inactive']);

/** POST /admin/branches — matches admin-app BranchMaster fields only. */
export const createBranchBodySchema = z.object({
  /** Optional client-generated UUID (admin-app sends one on create). */
  id: z.string().trim().min(1).optional(),
  name: nonEmpty('Branch Name'),
  branchCode: nonEmpty('Branch Code'),
  city: nonEmpty('City'),
  state: nonEmpty('State'),
  branchManager: nonEmpty('Branch Manager'),
  mobile: nonEmpty('Mobile Number'),
  status: branchStatusSchema.optional(),
});

/** PUT /admin/branches/:id — full replace of BranchMaster fields. */
export const updateBranchBodySchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: nonEmpty('Branch Name'),
  branchCode: nonEmpty('Branch Code'),
  city: nonEmpty('City'),
  state: nonEmpty('State'),
  branchManager: nonEmpty('Branch Manager'),
  mobile: nonEmpty('Mobile Number'),
  status: branchStatusSchema.optional(),
});

export type CreateBranchBody = z.infer<typeof createBranchBodySchema>;
export type UpdateBranchBody = z.infer<typeof updateBranchBodySchema>;
