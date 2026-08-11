import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';

import { createRateLimiter } from '../../../common/middleware/rate-limiter';
import { authenticate } from '../../../common/middleware/authenticate';
import { optionalAuthenticate } from '../../../common/middleware/optional-authenticate';
import { requirePermission } from '../../../common/middleware/require-permission';
import { BadRequestError } from '../../../common/errors/app-error';

import { validateRequest } from '../../../common/middleware/validate';

import { asyncHandler } from '../../../common/utils/async-handler';

import { env } from '../../../config/env';

import { productController } from '../controller/product.controller';
import { PRODUCT_IMAGE_MAX_BYTES } from '../service/product-image.service';

import {
  listProductsQuerySchema,
  productIdParamSchema,
  productImageIdParamSchema,
  productSlugParamSchema,
  createProductBodySchema,
} from '../validator/product.validator';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES },
});

function handleImageMulterError(err: unknown, _req: Request, _res: Response, next: NextFunction) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new BadRequestError('Image must be 5MB or smaller.'));
    }
    return next(new BadRequestError(`Image upload failed: ${err.message}`));
  }
  return next(err);
}

function uploadProductImage(req: Request, res: Response, next: NextFunction) {
  imageUpload.single('image')(req, res, (err: unknown) => handleImageMulterError(err, req, res, next));
}



const limiter = createRateLimiter({
  max: env.RATE_LIMIT_MAX,
  message: {

    success: false,

    message: 'Too many product requests. Please try again later.',

    code: 'TOO_MANY_REQUESTS',

  },
});



export const productRouter = Router();



productRouter.use(limiter);



productRouter.get(

  '/',

  validateRequest(listProductsQuerySchema, 'query'),
  asyncHandler(productController.list),
);

productRouter.post(
  '/',
  authenticate,
  requirePermission('products.create'),
  validateRequest(createProductBodySchema, 'body'),
  asyncHandler(productController.create),
);

productRouter.post(
  '/images',
  authenticate,
  uploadProductImage,
  asyncHandler(productController.uploadImage),
);

productRouter.get(
  '/images/:imageId',
  validateRequest(productImageIdParamSchema, 'params'),
  asyncHandler(productController.streamImage),
);

productRouter.get(
  '/slug/:slug',
  optionalAuthenticate,
  validateRequest(productSlugParamSchema, 'params'),
  asyncHandler(productController.getBySlug),
);

productRouter.get(
  '/:productId',
  optionalAuthenticate,
  validateRequest(productIdParamSchema, 'params'),
  asyncHandler(productController.getById),
);

productRouter.put(
  '/:productId',
  authenticate,
  requirePermission('products.edit'),
  validateRequest(productIdParamSchema, 'params'),
  asyncHandler(productController.update),
);

productRouter.delete(
  '/:productId',
  authenticate,
  requirePermission('products.delete'),
  validateRequest(productIdParamSchema, 'params'),
  asyncHandler(productController.remove),
);

