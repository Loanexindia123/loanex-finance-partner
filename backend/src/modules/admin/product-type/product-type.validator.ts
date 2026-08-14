import { z } from 'zod';

const nonEmptyName = z
  .string()
  .trim()
  .min(1, 'Product Type name is required');

const statusSchema = z.enum(['active', 'inactive']);

/** POST /admin/product_types */
export const createProductTypeBodySchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: nonEmptyName,
  status: statusSchema.optional(),
});

/** PUT /admin/product_types/:id */
export const updateProductTypeBodySchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: nonEmptyName.optional(),
  status: statusSchema.optional(),
});

export type CreateProductTypeBody = z.infer<typeof createProductTypeBodySchema>;
export type UpdateProductTypeBody = z.infer<typeof updateProductTypeBodySchema>;
