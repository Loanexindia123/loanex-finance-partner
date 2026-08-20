import { Response } from 'express';

import { sendSuccess } from '../../../common/utils/api-response';
import type { AuthenticatedRequest } from '../../../common/middleware/authenticate';
import { ForbiddenError, UnauthorizedError } from '../../../common/errors/app-error';
import { rolesService } from '../../rbac/roles.service';
import { resolveIsDealerUserId } from '../../admin/dealer/dealer-account';
import { jsonDb } from '../../../config/json-db';

import type {
  ListProductsQuery,
  ProductIdParam,
  ProductImageIdParam,
  ProductSlugParam,
} from '../dto/product.dto';

import { productService } from '../service/product.service';
import { storeProductImage, streamProductImage } from '../service/product-image.service';
import { isDealerUser, isEmployeeUser, isRestrictedCatalogUser } from '../utils/product-emi';

async function resolveIsEmployeeUserId(userId: string): Promise<boolean> {
  if (isEmployeeUser(userId)) return true;
  try {
    const { authRepository } = await import('../../auth/auth.repository');
    const fromMongo = await authRepository.findById(userId);
    if (!fromMongo) return false;
    const collection = jsonDb.getCollection('users');
    if (!collection.some((u: any) => u.id === fromMongo.id)) {
      const { profiles: _profiles, ...row } = fromMongo as any;
      collection.push(row);
    }
    return isEmployeeUser(userId);
  } catch {
    return false;
  }
}

async function canViewHiddenProducts(req: AuthenticatedRequest): Promise<boolean> {
  const userId = req.user?.sub;
  if (!userId) return false;
  if ((await resolveIsDealerUserId(userId)) || (await resolveIsEmployeeUserId(userId))) {
    return true;
  }
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

/** Reject expired/invalid Bearer tokens so we never fall through to the public catalog. */
function assertOptionalAuth(req: AuthenticatedRequest): void {
  if (req.authFailed) {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

/** Employees and Dealers may save for approval but cannot publish/approve products. */
function assertEmployeeCannotPublish(userId: string | undefined, status: unknown): void {
  if (!userId) return;
  const next = String(status ?? '').trim().toLowerCase();
  if (next !== 'active') return;
  if (isRestrictedCatalogUser(userId)) {
    throw new ForbiddenError(
      'You cannot publish products. Save for approval and wait for an admin to approve.',
    );
  }
}

function actorId(req: AuthenticatedRequest): string {
  return String(req.user?.sub ?? '').trim();
}

export class ProductController {
  list = async (req: AuthenticatedRequest, res: Response) => {
    assertOptionalAuth(req);
    const allowHidden = await canViewHiddenProducts(req);
    const data = await productService.list(req.validatedQuery as ListProductsQuery, {
      forceCustomerVisible: !allowHidden,
      // Staff list: hierarchy filter. Customer catalog: no actor scoping.
      actorUserId: allowHidden ? actorId(req) : undefined,
    });
    return sendSuccess(res, data, 'Products fetched');
  };

  getById = async (req: AuthenticatedRequest, res: Response) => {
    assertOptionalAuth(req);
    const { productId } = req.validatedParams as ProductIdParam;
    const allowHidden = await canViewHiddenProducts(req);
    const data = await productService.getById(productId, {
      allowHidden,
      actorUserId: allowHidden ? actorId(req) : undefined,
    });
    return sendSuccess(res, data, 'Product fetched');
  };

  getBySlug = async (req: AuthenticatedRequest, res: Response) => {
    assertOptionalAuth(req);
    const { slug } = req.validatedParams as ProductSlugParam;
    const allowHidden = await canViewHiddenProducts(req);
    const data = await productService.getBySlug(slug, {
      allowHidden,
      actorUserId: allowHidden ? actorId(req) : undefined,
    });
    return sendSuccess(res, data, 'Product fetched');
  };

  create = async (req: AuthenticatedRequest, res: Response) => {
    const userId = actorId(req);
    if (!userId) {
      throw new ForbiddenError('Not authorized for this action');
    }
    const body = (req as any).validatedBody || req.body;
    assertEmployeeCannotPublish(userId, body?.status);
    const data = await productService.create(body, userId);
    return sendSuccess(res, data, 'Product created successfully');
  };

  update = async (req: AuthenticatedRequest, res: Response) => {
    const userId = actorId(req);
    if (!userId) {
      throw new ForbiddenError('Not authorized for this action');
    }
    const { productId } = req.validatedParams as ProductIdParam;
    const body = req.body;
    assertEmployeeCannotPublish(userId, body?.status);
    const data = await productService.update(productId, body, userId);
    return sendSuccess(res, data, 'Product updated successfully');
  };

  remove = async (req: AuthenticatedRequest, res: Response) => {
    const userId = actorId(req);
    if (!userId) {
      throw new ForbiddenError('Not authorized for this action');
    }
    const { productId } = req.validatedParams as ProductIdParam;
    const data = await productService.remove(productId, userId);
    return sendSuccess(res, data, 'Product deleted successfully');
  };

  uploadImage = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenError('Not authorized for this action');
    }
    const permissions = await rolesService.resolveUserPermissions(userId);
    const canUpload =
      isDealerUser(userId) ||
      permissions.some(
        (p) =>
          p === 'products.create' ||
          p === 'products.edit' ||
          p === 'masters.create' ||
          p === 'masters.edit',
      );
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
