import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  search: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  category: z.string().trim().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'ALL']).default('ALL'),
  emiAvailable: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  featured: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  trending: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  recommended: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  newArrival: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  sort: z.enum(['price_asc', 'price_desc', 'latest', 'name']).default('latest'),
  status: z.enum(['all', 'active', 'inactive', 'draft']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(12),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const productIdParamSchema = z.object({
  productId: z.string().trim().min(1),
});

export type ProductIdParam = z.infer<typeof productIdParamSchema>;

export const productImageIdParamSchema = z.object({
  imageId: z.string().trim().regex(/^[a-fA-F0-9]{24}$/, 'Invalid image id'),
});

export type ProductImageIdParam = z.infer<typeof productImageIdParamSchema>;

export const productSlugParamSchema = z.object({
  slug: z.string().trim().min(1),
});

export type ProductSlugParam = z.infer<typeof productSlugParamSchema>;

export const createProductBodySchema = z
  .object({
    id: z.string().trim().optional(),
    name: z.string().trim().min(1),
    slug: z.string().trim().optional(),
    sku: z.string().trim().optional(),
    brand: z.string().trim().optional(),
    description: z.string().trim().optional(),
    shortDescription: z.string().trim().optional(),
    category: z.string().trim().optional(),
    // Accept UUID or legacy string ids / category names used by Admin wizard
    categoryId: z.string().trim().optional(),
    image: z.string().trim().optional(),
    galleryImages: z.array(z.string()).optional(),
    price: z.coerce.number().min(0),
    mrp: z.coerce.number().min(0).optional(),
    stock: z.coerce.number().int().min(0).optional(),
    status: z.enum(['active', 'draft', 'out_of_stock', 'archived', 'inactive']).optional(),
    emiAvailable: z.boolean().optional(),
    featured: z.boolean().optional(),
    trending: z.boolean().optional(),
    recommended: z.boolean().optional(),
    newArrival: z.boolean().optional(),
    emiStartingFrom: z.coerce.number().min(0).optional(),
    warranty: z.string().trim().optional(),
    hsnCode: z.string().trim().optional(),
    manufacturer: z.string().trim().optional(),
    specifications: z.any().optional(),
    features: z.any().optional(),
    colourSizeVariant: z.string().trim().optional(),
    keywords: z.union([z.string(), z.array(z.string())]).optional(),
    wizardData: z.any().optional(),
  })
  .passthrough();

export type CreateProductBody = z.infer<typeof createProductBodySchema>;
