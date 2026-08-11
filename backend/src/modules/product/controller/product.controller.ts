import { Response } from 'express';

import { sendSuccess } from '../../../common/utils/api-response';
import type { AuthenticatedRequest } from '../../../common/middleware/authenticate';
import { ForbiddenError } from '../../../common/errors/app-error';
import { rolesService } from '../../rbac/roles.service';

import type {
  ListProductsQuery,
  ProductIdParam,
  ProductImageIdParam,
  ProductSlugParam,
} from '../dto/product.dto';

import { productService } from '../service/product.service';
import { storeProductImage, streamProductImage } from '../service/product-image.service';

async function canViewHiddenProducts(req: AuthenticatedRequest): Promise<boolean> {
  const userId = req.user?.sub;
  if (!userId) return false;
  try {
    const permissions = await rolesService.resolveUserPermissions(userId);
    return permissions.some(
      (p) =>
        p === 'products.view' ||
        p === 'products.edit' ||
        p === 'products.create' ||
        p === 'products.delete',
    );
  } catch {
    return false;
  }
}

export class ProductController {
  list = async (req: AuthenticatedRequest, res: Response) => {
    const data = await productService.list(req.validatedQuery as ListProductsQuery);
    return sendSuccess(res, data, 'Products fetched');
  };

  getById = async (req: AuthenticatedRequest, res: Response) => {
    const { productId } = req.validatedParams as ProductIdParam;
    const allowHidden = await canViewHiddenProducts(req);
    const data = await productService.getById(productId, { allowHidden });
    return sendSuccess(res, data, 'Product fetched');
  };

  getBySlug = async (req: AuthenticatedRequest, res: Response) => {
    const { slug } = req.validatedParams as ProductSlugParam;
    const allowHidden = await canViewHiddenProducts(req);
    const data = await productService.getBySlug(slug, { allowHidden });
    return sendSuccess(res, data, 'Product fetched');
  };

  create = async (req: AuthenticatedRequest, res: Response) => {
    const body = (req as any).validatedBody || req.body;
    const data = await productService.create(body);
    return sendSuccess(res, data, 'Product created successfully');
  };

  update = async (req: AuthenticatedRequest, res: Response) => {
    const { productId } = req.validatedParams as ProductIdParam;
    const body = req.body; // Since we might not have a specific validator for update yet, we'll use raw body or partial schema
    const data = await productService.update(productId, body);
    return sendSuccess(res, data, 'Product updated successfully');
  };

  remove = async (req: AuthenticatedRequest, res: Response) => {
    const { productId } = req.validatedParams as ProductIdParam;
    const data = await productService.remove(productId);
    return sendSuccess(res, data, 'Product deleted successfully');
  };

  uploadImage = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenError('Not authorized for this action');
    }
    const permissions = await rolesService.resolveUserPermissions(userId);
    const canUpload = permissions.some((p) => p === 'products.create' || p === 'products.edit');
    if (!canUpload) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }

    const data = await storeProductImage(req.file);
    return sendSuccess(res, data, 'Image uploaded');
  };

  streamImage = async (req: AuthenticatedRequest, res: Response) => {
    const { imageId } = req.validatedParams as ProductImageIdParam;
    await streamProductImage(imageId, res);
  };
}

export const productController = new ProductController();
